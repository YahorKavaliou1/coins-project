from fastapi import FastAPI

from app.api import auth, coins, countries, denominations, metals, users

app = FastAPI(title="Coins API")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(countries.router)
app.include_router(metals.router)
app.include_router(denominations.router)
app.include_router(coins.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
