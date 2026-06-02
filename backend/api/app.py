from fastapi import FastAPI

from backend.api.routes import router

app = FastAPI(title="ADI Python Backend", version="0.1.0")
app.include_router(router)
