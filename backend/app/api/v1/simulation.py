import uuid
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db
from backend.app.services.simulation_service import SimulationService

router = APIRouter()


@router.get("/scenarios")
def list_simulation_scenarios():
    """Lists reproducible adversarial attack scenarios for the Attack Simulation Lab."""
    return SimulationService.list_scenarios()


@router.post("/run/{scenario_id}")
def run_simulation_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    x_correlation_id: str = Header(default_factory=lambda: str(uuid.uuid4()))
):
    """
    Executes a reproducible adversarial scenario against the live backend policy engine.
    Records actual database records, runs deterministic checks, and appends to audit ledger.
    """
    try:
        result = SimulationService.run_scenario(
            db=db,
            scenario_id=scenario_id,
            correlation_id=x_correlation_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
