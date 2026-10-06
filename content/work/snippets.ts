/**
 * "Code in the wild" snippets for the case studies.
 * Most are ILLUSTRATIVE — written to show the shape of the technique, not copied from the production codebases —
 * and labelled as such on the site. A snippet with a `source` is a real excerpt (lines elided with "…"), labelled
 * "from the project" and linked to where it comes from.
 * TODO(vishal): replace the illustrative ones with real excerpts if you want to show actual code.
 */
export type Snippet = {
  id: string;
  title: string;
  lang: "ts" | "tsx" | "dart" | "python";
  caption: string;
  code: string;
  /** A real excerpt: where it is from. Without it the snippet is illustrative. */
  source?: { label: string; href: string };
};

const ZEROCONNECT = {
  label: "ZeroConnect · Lan_research.py",
  href: "https://github.com/sambhav302005-coder/ZeroConnect---Secure-P2P-Communication-Platform/blob/main/Lan_research.py",
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
  "ls-discovery": {
    id: "ls-discovery",
    title: "Announcing a peer on the local network",
    lang: "python",
    caption:
      "Every peer broadcasts its name, address and TCP port every 3 seconds; the others listen on UDP 9998.",
    source: ZEROCONNECT,
    code: `def broadcast_presence(self):
    """Broadcast presence to network"""
    try:
        self.broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        while self.running:
            message = {
                "type": "peer_announcement",
                "name": getattr(self.callback, 'user_name', {}).get() or "Anonymous",
                "ip": self.get_local_ip(),
                "port": 9999
            }

            data = json.dumps(message).encode('utf-8')
            # Broadcast immediately on start, then every 3 seconds
            self.broadcast_socket.sendto(data, ('<broadcast>', self.discovery_port))
            time.sleep(3)  # Reduced from 5 to 3 for faster discovery
    …`,
  },
  "ls-frame": {
    id: "ls-frame",
    title: "One TCP session, many streams",
    lang: "python",
    caption:
      "Every message is framed with its type and length; chat (3) and files (5) are encrypted with Fernet first, video (1) and screen (10) frames are pickled.",
    source: ZEROCONNECT,
    code: `def send_data(self, data_type, data):
    """Send data to peer"""
    if not self.is_connected or not self.client_socket:
        return

    try:
        if data_type in [3, 5]:
            if isinstance(data, str):
                data = data.encode('utf-8')
            data = self.security_manager.encrypt_data(data)
        elif isinstance(data, str):
            data = data.encode('utf-8')
        elif data_type in [1, 10]:
            data = pickle.dumps(data)

        header = struct.pack("!II", data_type, len(data))
        self.client_socket.sendall(header + data)
    …`,
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
