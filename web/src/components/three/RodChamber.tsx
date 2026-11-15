"use client";
import { Component, type ReactNode, type RefObject, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import { VolumetricFlame } from "./VolumetricFlame";
import { frontDistance, type Environment } from "@/lib/simulation";

export type SharedChamberView={position:[number,number,number];target:[number,number,number];key:string;version:number}|null;
export type ChamberProps={rate:number|null;observed:number|null;seconds:number;diameter:number;environment:Environment;light:boolean;flow:boolean;camera:"perspective"|"front";reset:number;playing:boolean;reducedMotion:boolean;sharedView:RefObject<SharedChamberView>;publishView:(view:NonNullable<SharedChamberView>)=>void};

function LinkedCamera(p:ChamberProps){
  const controls=useRef<Controls>(null),dragging=useRef(false),seen=useRef(-1);
  const camera=useThree(state=>state.camera);
  const key=`${p.camera}:${p.reset}`;
  useFrame(()=>{const shared=p.sharedView.current;if(!shared||shared.key!==key||shared.version===seen.current||dragging.current||!controls.current)return;
    seen.current=shared.version;camera.position.fromArray(shared.position);controls.current.target.fromArray(shared.target);controls.current.update();});
  return <OrbitControls ref={controls} enableDamping={false} enablePan={false} minDistance={10} maxDistance={19} target={[0,.65,0]} maxPolarAngle={Math.PI*.7} minPolarAngle={Math.PI*.22}
    onStart={()=>{dragging.current=true;}} onEnd={()=>{dragging.current=false;}}
    onChange={()=>{if(!dragging.current||!controls.current)return;const version=(p.sharedView.current?.version??0)+1;seen.current=version;
      p.publishView({position:camera.position.toArray() as [number,number,number],target:controls.current.target.toArray() as [number,number,number],key,version});}}/>;
}

function ChamberObjects(p:ChamberProps){
  const distance=frontDistance(p.rate,p.seconds),y=2.5-distance/10,marker=2.5-frontDistance(p.observed,p.seconds)/10;
  const radius=p.diameter/20,metal=p.light?"#a7b5c0":"#415568",accent=p.light?"#66818e":"#38576a";
  return <>
    <ambientLight intensity={p.light?1.8:1}/><directionalLight position={[3,5,5]} intensity={2.5}/><directionalLight position={[-4,2,-2]} intensity={1.5} color="#bedbe5"/>
    <mesh position={[0,-2.95,0]}><cylinderGeometry args={[1.7,1.85,.18,64]}/><meshStandardMaterial color={metal} metalness={.7} roughness={.35}/></mesh>
    <mesh position={[0,-2.72,0]}><cylinderGeometry args={[.8,.9,.28,48]}/><meshStandardMaterial color={metal} metalness={.65} roughness={.4}/></mesh>
    <mesh><cylinderGeometry args={[radius,radius,5,48]}/><meshStandardMaterial color="#252b31" roughness={.78} metalness={0}/></mesh>
    <Line points={[[-1.7,-2.5,.3],[-1.7,2.5,.3]]} color={accent} lineWidth={1}/>
    {Array.from({length:11},(_,i)=><Line key={i} points={[[-1.7,-2.5+i*.5,.3],[-1.7+(i%2===0?.22:.1),-2.5+i*.5,.3]]} color={accent} lineWidth={1}/>)}
    {/* Traversed-distance ruler, not claimed consumed/charred material. */}
    {p.rate!==null&&distance>0&&<Line points={[[-1.7,2.5,.3],[-1.7,y,.3]]} color="#6bcdf0" lineWidth={2}/>}
    {p.rate!==null&&distance<50&&<VolumetricFlame radius={radius} front={y} environment={p.environment} playing={p.playing} reducedMotion={p.reducedMotion} light={p.light}/>}
    {p.rate!==null&&<mesh position={[0,y,0]} rotation={[Math.PI/2,0,0]} renderOrder={3}><torusGeometry args={[radius+.07,.025,12,64]}/><meshBasicMaterial color="#81deff" transparent opacity={1} toneMapped={false}/></mesh>}
    {p.observed!==null&&<mesh position={[0,marker,0]} rotation={[Math.PI/2,0,0]} renderOrder={3}><torusGeometry args={[radius+.22,.019,8,64]}/><meshBasicMaterial color="#f6ac52" transparent opacity={1} toneMapped={false}/></mesh>}
    {p.flow&&[-1.12,1.12].map(x=><group key={x}><Line points={[[x,-2.1,-.2],[x,2.1,-.2]]} color={p.light?"#557e8e":"#5e9dad"} transparent opacity={.55} dashed dashSize={.12} gapSize={.14}/><mesh position={[x,2.2,-.2]}><coneGeometry args={[.065,.18,8]}/><meshBasicMaterial color="#5e9dad"/></mesh></group>)}
    <gridHelper args={[10,20,p.light?"#c2cdd5":"#263946",p.light?"#d8e0e6":"#172a35"]} position={[0,-3.07,0]}/>
  </>;
}
class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="scene-fallback">3D rendering unavailable. Numerical comparisons remain available below.</div>:this.props.children;}}
export default function RodChamber(p:ChamberProps){return <SceneBoundary key={p.reset}><Canvas key={`${p.camera}-${p.reset}`} dpr={[1,1.5]} camera={{position:p.camera==="front"?[0,.65,14]:[5,2.8,13],fov:42}} gl={{antialias:true,alpha:true}} fallback={<div className="scene-fallback">WebGL unavailable. Use the numerical comparison below.</div>}><ChamberObjects {...p}/><LinkedCamera {...p}/></Canvas></SceneBoundary>;}
