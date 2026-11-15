"""Conditional, no-ML cylinder energy balance. SI throughout; never a safety model.

Delichatsios et al. (2000), printed2836/2838, Eq1/7. Effective-property
closures on printed2838-2839 were calibrated by the authors against CFD.
Mixing these with Thomsen2020 Eq6 is our explicitly unvalidated extension.
"""
from dataclasses import dataclass
import math
import numpy as np
from scipy.optimize import brentq

@dataclass(frozen=True)
class Assumptions:
    rho_s: float = 1190.0
    cp_s: float = 1465.0
    k_s: float = .19
    t_pyrolysis: float = 640.0
    t_ambient: float = 300.0
    alpha_heating: float = 8.8e-4
    alpha_curvature: float = 1.7e-4
    curvature_c: float = 3.21
    emissivity: float = 1.0
    energy_air_w_per_m: float = 127.0
    reference_oxygen_mass_fraction: float = .233
    kappa: float = 3.5

def oxygen_mass_fraction(oxygen_pct):
    if not math.isfinite(oxygen_pct) or not 0<oxygen_pct<100:
        raise ValueError('Oxygen must be between0 and100 volume percent.')
    x=oxygen_pct/100
    return 32*x/(32*x+28*(1-x)) # Binary O2/N2 approximation, not a measured diluent.

def curvature_factor(x):
    if x<0 or not math.isfinite(x):raise ValueError('Invalid curvature argument')
    return 1.0 if x==0 else x/math.log1p(x)

def terms(speed_m_s, radius_m, flow_m_s, oxygen_pct, a):
    """All energy terms W/m of cylinder circumference; finite-depth correction."""
    vr=flow_m_s+speed_m_s
    if speed_m_s<=0 or radius_m<=0 or vr<=0:raise ValueError('Positive speed, radius and relative flow required')
    lg=a.alpha_heating/vr
    lg_curvature=a.alpha_curvature/vr
    depth=min(radius_m,math.sqrt((a.k_s/(a.rho_s*a.cp_s))*lg/speed_m_s))
    heating=a.rho_s*a.cp_s*(a.t_pyrolysis-a.t_ambient)*speed_m_s*depth*(1-depth/(2*radius_m))
    energy=a.energy_air_w_per_m*oxygen_mass_fraction(oxygen_pct)/a.reference_oxygen_mass_fraction
    incoming=curvature_factor(a.curvature_c*lg_curvature/radius_m)*energy
    radiation=a.emissivity*5.670374419e-8*(a.t_pyrolysis**4-a.t_ambient**4)*lg
    return dict(heating_w_m=heating,incoming_w_m=incoming,radiation_w_m=radiation,
                residual_w_m=heating+ radiation-incoming,heated_depth_m=depth,
                heating_length_m=lg,curvature_length_m=lg_curvature)

def predict(oxygen_pct, diameter_mm, flow_cms, gravity_fraction, a=Assumptions()):
    values=[oxygen_pct,diameter_mm,flow_cms,gravity_fraction,*a.__dict__.values()]
    if not all(math.isfinite(v) for v in values):raise ValueError('Finite inputs required')
    if diameter_mm<=0 or flow_cms<0 or gravity_fraction<0:raise ValueError('Invalid geometry/flow/gravity')
    if a.t_pyrolysis<=a.t_ambient or min(a.rho_s,a.cp_s,a.k_s,a.alpha_heating,a.alpha_curvature,a.curvature_c,a.energy_air_w_per_m,a.reference_oxygen_mass_fraction)<=0 or not 0<=a.emissivity<=1 or a.kappa<0:raise ValueError('Invalid physical assumptions')
    oxygen_mass_fraction(oxygen_pct)
    r=diameter_mm/2000
    u=((flow_cms/100)**4+(9.80665*gravity_fraction*a.kappa*r)**2)**.25
    # Logarithmic numerical search interval is recorded, not a hidden prediction clamp.
    grid=np.geomspace(1e-10,1.0,1601)
    residual=lambda v:terms(v,r,u,oxygen_pct,a)['residual_w_m']
    fs=[residual(v) for v in grid]; roots=[]
    for lo,hi,flo,fhi in zip(grid[:-1],grid[1:],fs[:-1],fs[1:]):
        if flo*fhi<0:
            root=brentq(residual,lo,hi,xtol=1e-15,rtol=1e-12)
            if not roots or abs(root-roots[-1])>1e-12:roots.append(root)
    result=dict(effective_flow_cms=u*100,roots_mms=[v*1000 for v in roots],root_count=len(roots),
                rate_mms=None,status='no_bracketed_root',terms=None)
    if len(roots)==1:
        result.update(rate_mms=roots[0]*1000,status='conditional_solution',terms=terms(roots[0],r,u,oxygen_pct,a))
    elif len(roots)>1:result['status']='multiple_roots_no_branch_selection'
    return result
