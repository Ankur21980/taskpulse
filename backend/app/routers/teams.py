from typing import List

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.database import get_db
from app.mappers import user_doc_to_out
from app.repositories.users import list_users_by_team
from app.schemas import UserOut
from app.seed import DEMO_TEAM_ID

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/demo/members", response_model=List[UserOut])
def list_demo_members(db: Database = Depends(get_db)):
    users = list_users_by_team(db, DEMO_TEAM_ID)
    return [user_doc_to_out(u) for u in users]
