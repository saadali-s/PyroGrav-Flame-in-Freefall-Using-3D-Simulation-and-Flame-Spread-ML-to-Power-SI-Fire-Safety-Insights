"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "@/lib/simulation";

// Artistic density field integrated through a 3D box. No flame/thermal physics
// is inferred here: only the supplied front coordinate comes from a burn rate.
export const flameVertex = `
varying vec3 localPosition;
void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const flameFragment = `
precision highp float;
varying vec3 localPosition;
uniform vec3 localEye;
uniform float time;
uniform float earth;
uniform float lightMode;
uniform float rodRadius;
uniform float rodTop;
uniform float rodBottom;

float hash3(vec3 p){
  p=fract(p*.1031);
  p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 cell=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(
    mix(mix(hash3(cell),hash3(cell+vec3(1,0,0)),f.x),
        mix(hash3(cell+vec3(0,1,0)),hash3(cell+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash3(cell+vec3(0,0,1)),hash3(cell+vec3(1,0,1)),f.x),
        mix(hash3(cell+vec3(0,1,1)),hash3(cell+vec3(1,1,1)),f.x),f.y),f.z);
}
float densityAt(vec3 p){
  float h=clamp(p.y+.5,0.,1.);
  // The rising noise, folds and moving tongues are decorative, not a flow solver.
  vec2 bend=mix(.014,.065,earth)*h*h*vec2(sin(h*5.-time*1.9),cos(h*7.-time*1.4));
  float radial=length(p.xz-bend);
  float earthWidth=.37*pow(1.-h,.72)+.008;
  float spaceWidth=.39*sqrt(max(0.,1.-pow((h-.28)/.70,2.)));
  float width=mix(spaceWidth,earthWidth,earth);
  if(radial>width+.08)return 0.;
  vec3 advected=vec3(p.x*5.,h*3.2-time*mix(.55,1.4,earth),p.z*5.);
  float coarse=noise3(advected);
  float fine=noise3(advected*2.13+vec3(7.3,-time*.35,1.7));
  float detail=noise3(advected*4.21+vec3(2.1,-time*.2,9.2));
  float turbulence=coarse*.57+fine*.29+detail*.14;
  float folds=(turbulence-.48)*mix(.075,.17,earth)*(.25+h);
  float edge=1.-smoothstep(width*.54+folds,width+folds,radial);
  float tongues=smoothstep(.20+h*.29,.70,turbulence);
  float envelope=edge*smoothstep(0.,.028,h)*(1.-smoothstep(.86,1.,h));
  return envelope*mix(.23+turbulence*.65,.18+tongues*1.7,earth);
}
void main(){
  vec3 direction=normalize(localPosition-localEye);
  vec3 safeDirection=mix(vec3(.00001),direction,step(vec3(.00001),abs(direction)));
  vec3 inv=1./safeDirection;
  vec3 lo=(-vec3(.5)-localEye)*inv;
  vec3 hi=(vec3(.5)-localEye)*inv;
  vec3 nearBound=min(lo,hi),farBound=max(lo,hi);
  float enter=max(max(nearBound.x,nearBound.y),nearBound.z);
  float leave=min(min(farBound.x,farBound.y),farBound.z);
  enter=max(0.,enter);
  if(leave<=enter)discard;
  float stepLength=(leave-enter)/48.;
  vec4 accumulated=vec4(0.);
  for(int i=0;i<48;i++){
    vec3 p=localEye+direction*(enter+(float(i)+.5)*stepLength);
    float radial=length(p.xz);
    // Stop at the opaque PMMA cylinder. This preserves near-side flame emission
    // and prevents far-side emission showing through the solid rod.
    if(radial<rodRadius && p.y>=rodBottom && p.y<=rodTop)break;
    float density=densityAt(p);
    float h=p.y+.5;
    float blueBase=1.-smoothstep(.07,.25,h);
    vec3 blue=vec3(.08,.40,1.35);
    float core=smoothstep(.28,1.05,density)*(1.-smoothstep(.32,.86,h));
    vec3 warm=mix(vec3(1.45,.24,.018),vec3(1.65,1.22,.60),core);
    vec3 space=mix(vec3(.12,.35,1.18),vec3(1.32,.58,.23),smoothstep(.35,.75,density)*.68*(1.-blueBase));
    vec3 color=mix(space,mix(warm,blue,blueBase),earth);
    float alpha=1.-exp(-density*stepLength*mix(3.6,6.8,earth));
    alpha*=mix(1.,1.08,lightMode);
    accumulated.rgb+=(1.-accumulated.a)*color*alpha;
    accumulated.a+=(1.-accumulated.a)*alpha;
    if(accumulated.a>.97)break;
  }
  if(accumulated.a<.008)discard;
  gl_FragColor=vec4(accumulated.rgb/max(accumulated.a,.0001),accumulated.a);
}
`;

type Props={radius:number;front:number;environment:Environment;playing:boolean;reducedMotion:boolean;light:boolean};
export function VolumetricFlame({radius,front,environment,playing,reducedMotion,light}:Props){
  const mesh=useRef<THREE.Mesh>(null),material=useRef<THREE.ShaderMaterial>(null);
  const height=environment==="earth"?2.35:1.3;
  // Make the lower flame envelope wider than even the thickest displayed rod.
  const width=(radius+.38)*2.9;
  const scratch=useMemo(()=>({inverse:new THREE.Matrix4(),eye:new THREE.Vector3()}),[]);
  const uniforms=useMemo(()=>({localEye:{value:new THREE.Vector3()},time:{value:0},earth:{value:environment==="earth"?1:0},
    lightMode:{value:light?1:0},rodRadius:{value:radius/width},rodTop:{value:(2.5-front)/height-.5},rodBottom:{value:(-2.5-front)/height-.5}}),[environment,light,radius,width,front,height]);
  const clock=useRef(0);
  useFrame(({camera},dt)=>{
    if(!mesh.current||!material.current)return;
    if(playing&&!reducedMotion)clock.current+=Math.min(dt,.05);
    mesh.current.updateWorldMatrix(true,false);
    scratch.inverse.copy(mesh.current.matrixWorld).invert();
    camera.getWorldPosition(scratch.eye).applyMatrix4(scratch.inverse);
    material.current.uniforms.localEye.value.copy(scratch.eye);
    material.current.uniforms.time.value=clock.current;
  });
  return <mesh ref={mesh} position={[0,front+height/2,0]} scale={[width,height,width]} renderOrder={2}>
    <boxGeometry args={[1,1,1]}/>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={flameVertex} fragmentShader={flameFragment}
      transparent depthWrite={false} depthTest={false} side={THREE.BackSide} toneMapped={false}/>
  </mesh>;
}
