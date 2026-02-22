import * as THREE from 'three';
import type { CurveType } from './types';

const torusKnot = (t: number, time: number, p = 2, q = 3, R = 5, r = 2): THREE.Vector3 => {
  const phi = t * Math.PI * 2 * q + time * 0.1;
  const theta = t * Math.PI * 2 * p + time * 0.07;

  const x = (R + r * Math.cos(phi)) * Math.cos(theta);
  const y = (R + r * Math.cos(phi)) * Math.sin(theta);
  const z = r * Math.sin(phi);

  return new THREE.Vector3(x, y, z).multiplyScalar(0.8);
};

const trefoilKnot = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.08;

  const x = Math.sin(phi) + 2 * Math.sin(2 * phi);
  const y = Math.cos(phi) - 2 * Math.cos(2 * phi);
  const z = -Math.sin(3 * phi);

  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.4);
};

const cinquefoilKnot = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.06;

  const x = Math.cos(phi) * (2 - Math.cos(2 * phi / 5));
  const y = Math.sin(phi) * (2 - Math.cos(2 * phi / 5));
  const z = -Math.sin(2 * phi / 5);

  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.5);
};

const lissajous3D = (t: number, time: number, a = 3, b = 2, c = 5, scale = 5): THREE.Vector3 => {
  const phi = t * Math.PI * 2;
  const drift = time * 0.05;

  const x = Math.sin(a * phi + drift);
  const y = Math.sin(b * phi + drift * 1.3);
  const z = Math.sin(c * phi + drift * 0.7);

  return new THREE.Vector3(x, y, z).multiplyScalar(scale);
};

const sphericalRose = (t: number, time: number, k = 5, scale = 5): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.04;
  const r = Math.cos(k * phi);
  const theta = phi * 2 + time * 0.03;

  const x = r * Math.cos(phi) * Math.sin(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(theta) * 0.5;

  return new THREE.Vector3(x, y, z).multiplyScalar(scale);
};

const lorenzInspired = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 4 + time * 0.1;
  const wing = Math.sin(phi * 0.5) > 0 ? 1 : -1;

  const r = 2 + Math.cos(phi * 2);
  const x = r * Math.cos(phi) * wing;
  const y = r * Math.sin(phi);
  const z = Math.sin(phi * 3) * 1.5 + Math.cos(phi * 0.5) * 0.5;

  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.6);
};

export const getCurvePosition = (t: number, time: number, curveType: CurveType): THREE.Vector3 => {
  switch (curveType) {
    case 'torusKnot': return torusKnot(t, time, 3, 5);
    case 'trefoil': return trefoilKnot(t, time);
    case 'cinquefoil': return cinquefoilKnot(t, time);
    case 'lissajous3D': return lissajous3D(t, time, 3, 4, 7);
    case 'rose': return sphericalRose(t, time, 7);
    case 'lorenz': return lorenzInspired(t, time);
    default: return torusKnot(t, time);
  }
};

const smoothstep = (x: number): number => x * x * (3 - 2 * x);

export const blendCurves = (
  t: number,
  time: number,
  curve1: CurveType,
  curve2: CurveType,
  blend: number
): THREE.Vector3 => {
  const p1 = getCurvePosition(t, time, curve1);
  const p2 = getCurvePosition(t, time, curve2);
  return p1.lerp(p2, smoothstep(blend));
};

export const flowField = (position: THREE.Vector3, time: number, scale = 1.0): THREE.Vector3 => {
  const p = position.clone().multiplyScalar(0.3);
  const t = time * 0.15;

  const n1 = Math.sin(p.x * 1.3 + t) * Math.cos(p.y * 0.9 + t * 0.7) * Math.sin(p.z * 1.1 + t * 0.5);
  const n2 = Math.cos(p.x * 0.8 + t * 1.1) * Math.sin(p.y * 1.4 + t * 0.6) * Math.cos(p.z * 0.7 + t * 0.9);
  const n3 = Math.sin(p.x * 1.1 + t * 0.8) * Math.sin(p.y * 0.7 + t * 1.2) * Math.cos(p.z * 1.3 + t * 0.4);

  return new THREE.Vector3(
    n2 - n3,
    n3 - n1,
    n1 - n2
  ).multiplyScalar(0.015 * scale);
};

export const CURVE_SEQUENCE: CurveType[] = ['trefoil', 'lissajous3D', 'torusKnot', 'cinquefoil', 'rose', 'lorenz'];
export const CURVE_CYCLE_DURATION = 45;
export const CURVE_TRANSITION_DURATION = 8;
