from sqlalchemy.orm import Session

from app.models import Team, User

DEMO_TEAM_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USERS = [
    ("00000000-0000-0000-0000-000000000010", "Rahul Kapoor", "rahul@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000011", "Priya Sharma", "priya@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000012", "Alex Chen", "alex@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000013", "Sam Rivera", "sam@demo.taskpulse.io"),
]


def seed_demo_data(db: Session) -> None:
    if db.query(Team).filter(Team.id == DEMO_TEAM_ID).first():
        return

    team = Team(id=DEMO_TEAM_ID, name="Product Team")
    db.add(team)
    for user_id, name, email in DEMO_USERS:
        db.add(User(id=user_id, name=name, email=email, team_id=DEMO_TEAM_ID))
    db.commit()
