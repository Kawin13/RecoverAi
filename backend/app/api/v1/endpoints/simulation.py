from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any

from app.schemas.simulation import (
    SimulationControls,
    SimulationPreset,
    MethodologyDoc,
    BatchSimulationResponse
)
from app.services.simulation_service import simulation_service

router = APIRouter()

@router.post("/run", response_model=BatchSimulationResponse, summary="Execute Deterministic Batch Recovery Simulation")
def run_batch_simulation(controls: SimulationControls) -> BatchSimulationResponse:
    """
    Executes a high-throughput deterministic simulation using real XGBoost model inference,
    root-cause failure diagnosis, Expected Recovery Value (ERV) minor unit math,
    and fintech safety guardrails. Benchmarks RecoverAI against simple baseline dunning rules.
    """
    try:
        return simulation_service.run_simulation(controls)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed to execute: {str(e)}")

@router.get("/presets", response_model=List[SimulationPreset], summary="Get Simulation Industry Presets")
def get_simulation_presets() -> List[SimulationPreset]:
    """
    Returns curated business presets: E-commerce Sale Day, SaaS Subscription Cycle,
    Food Delivery Peak Hour, Travel Booking Spike.
    """
    return simulation_service.get_presets()

@router.get("/methodology", response_model=MethodologyDoc, summary="Get Simulation Assumptions & Math Methodology")
def get_simulation_methodology() -> MethodologyDoc:
    """
    Returns complete documentation of mathematical assumptions, baseline rules,
    ML features, ERV minor unit calculation, and guardrail policies.
    """
    return simulation_service.get_methodology()
