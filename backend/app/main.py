from fastapi import FastAPI

from app.routers import auth, entries, feed, me, photos, users

app = FastAPI(title='MoveYourAss')
app.include_router(auth.router)
app.include_router(me.router)
app.include_router(entries.router)
app.include_router(photos.router)
app.include_router(users.router)
app.include_router(feed.router)


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}
