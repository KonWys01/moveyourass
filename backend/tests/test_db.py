from sqlalchemy import text


async def test_session_can_query(session):
    result = await session.execute(text('select 1'))

    assert result.scalar_one() == 1
