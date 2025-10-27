# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Environment Configuration

This project supports different environments:
- Staging: http://127.0.0.1:8000
- Production: https://be.haldiram.globalinfosofts.com

Environment variables are configured in:
- `.env` - Default environment (staging)
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## Available Scripts

- `npm run dev` - Start development server (default staging environment)
- `npm run dev:staging` - Start development server with staging environment
- `npm run dev:prod` - Start development server with production environment
- `npm run build` - Build for production
- `npm run build:staging` - Build for staging environment
- `npm run build:production` - Build for production environment
- `npm run lint` - Run ESLint
- `npm run preview` - Preview the built application

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.