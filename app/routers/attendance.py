# app/routers/attendance.py
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select
from typing import Optional, List
from datetime import datetime, timezone, timedelta, date
import math

# try zoneinfo, fallback to fixed IST offset
def now_ist():
    try:
        from zoneinfo import ZoneInfo
        try:
            return datetime.now(ZoneInfo("Asia/Kolkata"))
        except Exception:
            return datetime.now(timezone(timedelta(hours=5, minutes=30)))
    except Exception:
        return datetime.now(timezone(timedelta(hours=5, minutes=30)))

# --- adjust these imports to match your project structure ---
from ..database import get_session
from ..models import Attendance, User, Role
from ..schemas import PunchInOutIn, AttendanceOut
from ..deps import get_current_user, require_roles
from ..config import settings
# ----------------------------------------------------------

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

# Fixed site coordinates and radius
FIXED_LAT = 22.8491264
FIXED_LNG = 86.2257152
ALLOWED_RADIUS_METERS = 50

def haversine_distance_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def _check_geofence(lat: Optional[float], lng: Optional[float]):
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Location (lat,lng) required for punch.")
    dist = haversine_distance_m(lat, lng, FIXED_LAT, FIXED_LNG)
    if dist > ALLOWED_RADIUS_METERS:
        raise HTTPException(status_code=400, detail=f"Out of allowed geofence ({int(dist)} m away). Allowed: {ALLOWED_RADIUS_METERS} m.")
    return True

def _apply_security_location(payload: PunchInOutIn, current_user: User):
    """
    If a Security user is punching for someone (or punching themselves) and lat/lng were not provided,
    auto-fill the fixed gate coordinates so geofence check passes.
    """
    # Only auto-fill for security role
    if getattr(current_user, "role", None) == Role.SECURITY:
        if payload.lat is None or payload.lng is None:
            payload.lat = FIXED_LAT
            payload.lng = FIXED_LNG
    return payload

# ---------- Punch endpoints ----------
@router.post("/punch-in", response_model=AttendanceOut)
def punch_in(payload: PunchInOutIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """
    - Normal users must provide lat,lng.
    - Security may omit lat/lng; backend will use fixed gate coords.
    - Security/Admin/Master may provide for_user_id to punch for other users.
    """
    target_user_id = payload.for_user_id or current_user.id

    if payload.for_user_id and current_user.role not in (Role.SECURITY, Role.ADMIN, Role.MASTER):
        raise HTTPException(status_code=403, detail="Not permitted to punch for other users.")

    # Auto-fill location for security if not provided
    payload = _apply_security_location(payload, current_user)

    # Enforce geofence (normal users must have provided lat/lng; security will have been auto-filled)
    _check_geofence(payload.lat, payload.lng)

    # Prevent double in without out
    stmt = select(Attendance).where(Attendance.user_id == target_user_id).order_by(Attendance.timestamp_utc.desc())
    last = session.exec(stmt).first()
    if last and last.type == "in":
        raise HTTPException(status_code=400, detail="Already punched in. Punch out before punching in again.")

    ts_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
    ts_ist = now_ist()
    att = Attendance(
        user_id=target_user_id,
        type="in",
        timestamp_utc=ts_utc,
        timestamp_ist=ts_ist,
        lat=payload.lat,
        lng=payload.lng,
        recorded_by=current_user.id if payload.for_user_id else current_user.id,
        note=payload.note
    )
    session.add(att)
    session.commit()
    session.refresh(att)
    return att

@router.post("/punch-out", response_model=AttendanceOut)
def punch_out(payload: PunchInOutIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """
    Similar rules as punch-in. Requires an open 'in' to punch out.
    """
    target_user_id = payload.for_user_id or current_user.id

    if payload.for_user_id and current_user.role not in (Role.SECURITY, Role.ADMIN, Role.MASTER):
        raise HTTPException(status_code=403, detail="Not permitted to punch for other users.")

    payload = _apply_security_location(payload, current_user)
    _check_geofence(payload.lat, payload.lng)

    stmt = select(Attendance).where(Attendance.user_id == target_user_id).order_by(Attendance.timestamp_utc.desc())
    last = session.exec(stmt).first()
    if not last or last.type != "in":
        raise HTTPException(status_code=400, detail="No open punch-in found. Cannot punch out.")

    ts_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
    ts_ist = now_ist()
    att = Attendance(
        user_id=target_user_id,
        type="out",
        timestamp_utc=ts_utc,
        timestamp_ist=ts_ist,
        lat=payload.lat,
        lng=payload.lng,
        recorded_by=current_user.id if payload.for_user_id else current_user.id,
        note=payload.note
    )
    session.add(att)
    session.commit()
    session.refresh(att)
    return att

# ---------- Helper: pair in/out to intervals ----------
def pair_intervals(att_list: List[Attendance]):
    """
    Given ordered list of Attendance (oldest first), return list of (in_att, out_att) tuples.
    If an 'in' has no subsequent 'out', out_att is None.
    """
    intervals = []
    open_in = None
    for a in att_list:
        if a.type == "in":
            open_in = a
        elif a.type == "out":
            if open_in:
                intervals.append((open_in, a))
                open_in = None
            else:
                # stray out without in -> ignore
                pass
    if open_in:
        intervals.append((open_in, None))
    return intervals

# ---------- Query helpers ----------
def _apply_date_filter(stmt, date_from: Optional[date], date_to: Optional[date]):
    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        stmt = stmt.where(Attendance.timestamp_utc >= start_dt)
    if date_to:
        end_dt = datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)
        stmt = stmt.where(Attendance.timestamp_utc <= end_dt)
    return stmt

# ---------- User endpoints ----------
@router.get("/me", response_model=List[AttendanceOut])
def my_attendance(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    stmt = select(Attendance).where(Attendance.user_id == current_user.id)
    stmt = _apply_date_filter(stmt, date_from, date_to)
    stmt = stmt.order_by(Attendance.timestamp_utc.desc())
    offset = (page - 1) * per_page
    rows = session.exec(stmt.offset(offset).limit(per_page)).all()
    return rows

@router.get("/user/{user_id}", response_model=List[AttendanceOut], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))])
def user_attendance(
    user_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=2000),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Attendance).where(Attendance.user_id == user_id)
    stmt = _apply_date_filter(stmt, date_from, date_to)
    stmt = stmt.order_by(Attendance.timestamp_utc.desc())
    offset = (page - 1) * per_page
    rows = session.exec(stmt.offset(offset).limit(per_page)).all()
    return rows

@router.get("/all", response_model=List[AttendanceOut], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.SECURITY))])
def all_attendance(
    page: int = Query(1, ge=1),
    per_page: int = Query(200, ge=1, le=2000),
    user_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Attendance)
    if user_id:
        stmt = stmt.where(Attendance.user_id == user_id)
    stmt = _apply_date_filter(stmt, date_from, date_to)
    stmt = stmt.order_by(Attendance.timestamp_utc.desc())
    offset = (page - 1) * per_page
    rows = session.exec(stmt.offset(offset).limit(per_page)).all()
    return rows

# ---------- Reporting endpoints ----------
@router.get("/report/daily", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))])
def daily_report(
    user_id: int,
    day: date,
    session: Session = Depends(get_session),
):
    start_dt = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(day, datetime.max.time()).replace(tzinfo=timezone.utc)
    stmt = select(Attendance).where(Attendance.user_id == user_id).where(Attendance.timestamp_utc >= start_dt).where(Attendance.timestamp_utc <= end_dt).order_by(Attendance.timestamp_utc.asc())
    rows = session.exec(stmt).all()
    intervals = pair_intervals(rows)
    out = []
    total_seconds = 0
    for inn, outt in intervals:
        in_ts = inn.timestamp_ist if getattr(inn, "timestamp_ist", None) else inn.timestamp_utc
        out_ts = outt.timestamp_ist if outt and getattr(outt, "timestamp_ist", None) else (outt.timestamp_utc if outt else None)
        if outt:
            duration = (outt.timestamp_utc - inn.timestamp_utc).total_seconds()
            total_seconds += max(0, int(duration))
        else:
            duration = None
        out.append({
            "in_id": inn.id,
            "in_ts_ist": in_ts,
            "out_id": outt.id if outt else None,
            "out_ts_ist": out_ts,
            "duration_seconds": int(duration) if duration is not None else None,
            "note_in": getattr(inn, "note", None),
            "note_out": getattr(outt, "note", None) if outt else None
        })
    return {"user_id": user_id, "day": str(day), "intervals": out, "total_seconds": total_seconds}

@router.get("/report/range", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))])
def range_report(
    user_id: int,
    from_date: date,
    to_date: date,
    session: Session = Depends(get_session),
):
    results = []
    cur = from_date
    while cur <= to_date:
        rep = daily_report(user_id=user_id, day=cur, session=session)
        results.append(rep)
        cur = cur + timedelta(days=1)
    return {"user_id": user_id, "from_date": str(from_date), "to_date": str(to_date), "days": results}

# ---------- Admin: attendance by date (summary for all users) ----------
@router.get("/admin/by-date", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.SECURITY))])
def admin_attendance_by_date(
    day: date = Query(..., description="Date in YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    start_dt = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(day, datetime.max.time()).replace(tzinfo=timezone.utc)

    stmt = select(Attendance).where(Attendance.timestamp_utc >= start_dt).where(Attendance.timestamp_utc <= end_dt).order_by(Attendance.user_id, Attendance.timestamp_utc.asc())
    rows: list[Attendance] = session.exec(stmt).all()

    if not rows:
        return {"day": str(day), "count": 0, "users": []}

    grouped = defaultdict(list)
    for r in rows:
        grouped[r.user_id].append(r)

    results = []
    user_ids = list(grouped.keys())

    # bulk load users to avoid N+1 queries
    stmt_users = select(User).where(User.id.in_(user_ids))
    users_map = {u.id: u for u in session.exec(stmt_users).all()}

    for uid, att_list in grouped.items():
        intervals = pair_intervals(att_list)
        total_seconds = 0
        first_in_ist = None
        last_out_ist = None
        intervals_out = []

        for inn, outt in intervals:
            in_ts_ist = inn.timestamp_ist if getattr(inn, "timestamp_ist", None) else inn.timestamp_utc
            out_ts_ist = None
            duration = None
            if outt:
                out_ts_ist = outt.timestamp_ist if getattr(outt, "timestamp_ist", None) else outt.timestamp_utc
                duration = (outt.timestamp_utc - inn.timestamp_utc).total_seconds()
                total_seconds += max(0, int(duration))
                last_out_ist = out_ts_ist
            if first_in_ist is None:
                first_in_ist = in_ts_ist

            intervals_out.append({
                "in_id": inn.id,
                "in_ts_ist": in_ts_ist,
                "out_id": outt.id if outt else None,
                "out_ts_ist": out_ts_ist,
                "duration_seconds": int(duration) if duration is not None else None,
                "note_in": getattr(inn, "note", None),
                "note_out": getattr(outt, "note", None) if outt else None
            })

        user = users_map.get(uid)
        user_name = getattr(user, "full_name", None) or getattr(user, "name", None) or getattr(user, "email", None) or f"user-{uid}"

        results.append({
            "user_id": uid,
            "user_name": user_name,
            "first_in_ist": first_in_ist,
            "last_out_ist": last_out_ist,
            "total_seconds": total_seconds,
            "intervals": intervals_out
        })

    # sort by first_in_ist (earliest first)
    results.sort(key=lambda x: x["first_in_ist"] or datetime.max.replace(tzinfo=timezone.utc))

    return {"day": str(day), "count": len(results), "users": results}
