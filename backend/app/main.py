from fastapi import FastAPI

from app.routers import auth, entries, me

app = FastAPI(title='MoveYourAss')
app.include_router(auth.router)
app.include_router(me.router)
app.include_router(entries.router)


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}
