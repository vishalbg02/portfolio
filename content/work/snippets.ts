/**
 * "Code in the wild" snippets for the case studies.
 * ILLUSTRATIVE ONLY — written to show the shape of the technique, not copied from the
 * production codebases. They are labelled as such on the site.
 * TODO(vishal): replace with real excerpts if you want to show actual code.
 */
export type Snippet = {
  id: string;
  title: string;
  lang: "ts" | "tsx" | "dart" | "python";
  caption: string;
  code: string;
};

export const snippets: Record<string, Snippet> = {
  "gv-request-transaction": {
    id: "gv-request-transaction",
    title: "Tracking a service request in one transaction",
    lang: "ts",
    caption: "Allocate a unique request ID and write the request and its first status event atomically.",
    code: `import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";

export async function createServiceRequest(db: Firestore, customerId: string, serviceId: string) {
  const counterRef = doc(db, "counters", "serviceRequests");

  return runTransaction(db, async (tx) => {
    const counter = await tx.get(counterRef);
    const next = (counter.exists() ? counter.data().value : 0) + 1;
    const requestId = "REQ-" + String(next).padStart(6, "0");

    tx.set(counterRef, { value: next });
    tx.set(doc(db, "serviceRequests", requestId), {
      customerId,
      serviceId,
      status: "submitted",
      createdAt: serverTimestamp(),
    });
    tx.set(doc(db, "serviceRequests", requestId, "events", "0"), {
      status: "submitted",
      at: serverTimestamp(),
    });
    return requestId;
  });
}`,
  },
  "gv-role-guard": {
    id: "gv-role-guard",
    title: "Role-based access check",
    lang: "ts",
    caption: "One table maps each area of the app to the roles allowed in; the guard is a pure function.",
    code: `type Role = "customer" | "legalPartner" | "manager" | "admin";

const ACCESS: Record<string, Role[]> = {
  "/dashboard": ["customer"],
  "/partner": ["legalPartner", "admin"],
  "/manager": ["manager", "admin"],
  "/admin": ["admin"],
};

export function canAccess(role: Role, pathname: string): boolean {
  const area = Object.keys(ACCESS).find((prefix) => pathname.startsWith(prefix));
  return area ? ACCESS[area].includes(role) : true; // unlisted paths are public
}`,
  },
  "tn-attendance-stream": {
    id: "tn-attendance-stream",
    title: "Real-time attendance stream (Flutter)",
    lang: "dart",
    caption: "A Firestore query exposed as a Stream, so the UI rebuilds the moment a check-in lands.",
    code: `Stream<List<Attendance>> watchToday(String employeeId) {
  final start = DateTime.now().copyWith(hour: 0, minute: 0, second: 0);

  return FirebaseFirestore.instance
      .collection('attendance')
      .where('employeeId', isEqualTo: employeeId)
      .where('checkedInAt', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
      .orderBy('checkedInAt', descending: true)
      .snapshots()
      .map((snap) => snap.docs.map(Attendance.fromDoc).toList());
}`,
  },
  "tn-attendance-hook": {
    id: "tn-attendance-hook",
    title: "The same data on the web (React)",
    lang: "tsx",
    caption: "The web dashboard subscribes to the same collection, so both platforms stay in sync.",
    code: `import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

export function useTodaysAttendance(employeeId: string, since: Date) {
  const [rows, setRows] = useState<Attendance[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", employeeId),
      where("checkedInAt", ">=", since),
      orderBy("checkedInAt", "desc"),
    );
    return onSnapshot(q, (snap) => setRows(snap.docs.map(toAttendance)));
  }, [employeeId, since]);

  return rows;
}`,
  },
  "ls-handshake": {
    id: "ls-handshake",
    title: "Deriving a session key over a socket",
    lang: "python",
    caption: "Peers swap public keys, then derive the same 32-byte key for AES-256.",
    code: `import socket
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def handshake(sock: socket.socket) -> bytes:
    private = X25519PrivateKey.generate()
    sock.sendall(private.public_key().public_bytes_raw())
    peer = X25519PublicKey.from_public_bytes(sock.recv(32))

    shared = private.exchange(peer)
    return HKDF(
        algorithm=hashes.SHA256(), length=32, salt=None, info=b"lan-session"
    ).derive(shared)`,
  },
  "ls-encrypted-frame": {
    id: "ls-encrypted-frame",
    title: "Sending an encrypted frame",
    lang: "python",
    caption: "Each frame is length-prefixed and sealed with AES-256-GCM using a fresh nonce.",
    code: `import os
import struct
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def send_frame(sock, key: bytes, payload: bytes) -> None:
    nonce = os.urandom(12)
    sealed = nonce + AESGCM(key).encrypt(nonce, payload, None)
    sock.sendall(struct.pack("!I", len(sealed)) + sealed)`,
  },
  "vt-hotspot": {
    id: "vt-hotspot",
    title: "Placing a hotspot on the panorama sphere",
    lang: "ts",
    caption: "The panorama is an inside-out sphere; a hotspot is a point on it given by yaw and pitch.",
    code: `import * as THREE from "three";

const RADIUS = 500;

export function panoramaSphere(texture: THREE.Texture) {
  const geometry = new THREE.SphereGeometry(RADIUS, 64, 32);
  geometry.scale(-1, 1, 1); // flip so the texture faces inward
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
}

export function hotspotPosition(yawDeg: number, pitchDeg: number, radius = RADIUS - 10) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    radius * Math.cos(pitch) * Math.sin(yaw),
    radius * Math.sin(pitch),
    radius * Math.cos(pitch) * Math.cos(yaw),
  );
}`,
  },
};
