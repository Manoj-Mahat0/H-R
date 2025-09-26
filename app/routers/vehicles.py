from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from ..database import get_session
from ..models import Vehicle, User, Role
from ..schemas import VehicleCreate, VehicleRead, VehicleUpdate
from ..deps import get_current_user, require_roles
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


# Driver creates a vehicle (driver_id taken from token)
@router.post("/", response_model=VehicleRead, dependencies=[Depends(require_roles(Role.DRIVER, Role.ADMIN, Role.MASTER))])
def create_vehicle(payload: VehicleCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    v = Vehicle(
        driver_id=user.id,
        driver_mobile=payload.driver_mobile or user.phone,
        vehicle_number=payload.vehicle_number,
        lat=payload.lat,
        lng=payload.lng,
        capacity_weight=payload.capacity_weight,
        capacity_unit=payload.capacity_unit or "kg",
        details=payload.details,
        active=True
    )
    session.add(v)
    session.commit()
    session.refresh(v)
    return v

# Driver lists their vehicles; Admin/Master can list all optionally filtered by driver_id
@router.get("/", response_model=List[VehicleRead])
def list_vehicles(
    driver_id: Optional[int] = Query(None),
    me_only: Optional[bool] = Query(False, description="If true, return only current user's vehicles (driver only)"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Vehicle)
    # If current user is driver OR me_only requested, constrain to current user
    if user.role == Role.DRIVER or me_only:
        stmt = stmt.where(Vehicle.driver_id == user.id)
    else:
        # Admin/Master can optionally filter driver_id
        if driver_id is not None:
            stmt = stmt.where(Vehicle.driver_id == driver_id)
    rows = session.exec(stmt).all()
    return rows


# Get single vehicle (driver owns it OR admin/master can view)
@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(vehicle_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    v = session.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if user.role == Role.DRIVER and v.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return v


# Update vehicle (driver can update their own vehicle; admin/master can update any)
@router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    v = session.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if user.role == Role.DRIVER and v.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    changed = False
    for field, val in payload.dict(exclude_unset=True).items():
        setattr(v, field, val)
        changed = True
    if changed:
        v.updated_at = datetime.utcnow()
        session.add(v)
        session.commit()
        session.refresh(v)
    return v


# ✅ Hard delete vehicle (driver can delete own, admin/master can delete any)
@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    v = session.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if user.role == Role.DRIVER and v.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    session.delete(v)
    session.commit()
    return {"status": "deleted", "vehicle_id": vehicle_id}

