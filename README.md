# happy-emborji-backend

## Docker (Bun runtime)

This repository includes a multi-stage `Dockerfile` that uses the Bun runtime to build and run the application.

Build the image (from repository root):

```bash
docker build -t happy-emborji-backend:latest .
```

Run the container (provide any required environment variables, e.g. MONGODB_URI):

```bash
docker run -p 8081:8081 --env-file .env --rm happy-emborji-backend:latest
```

Notes:

- The container listens on port `8081` by default (or the value of `$PORT`).
- For production, pass `NODE_ENV=production` and any required secrets via environment variables or a secrets manager.
