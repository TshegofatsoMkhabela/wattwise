import type { Meter, MeterStatus } from "@/types";

const actualLocations = [
  { street: "Vilakazi St", area: "Orlando West", lat: -26.2384, lng: 27.9051 },
  { street: "Chris Hani Rd", area: "Diepkloof", lat: -26.2570, lng: 27.9150 },
  { street: "Modjadji St", area: "Meadowlands", lat: -26.2520, lng: 27.8760 },
  { street: "Mncube Dr", area: "Dube", lat: -26.2420, lng: 27.8900 },
  { street: "Kumalo St", area: "Orlando East", lat: -26.2290, lng: 27.9040 },
  { street: "Mahalefele Rd", area: "Dube", lat: -26.2320, lng: 27.8800 },
  { street: "Roodepoort Rd", area: "Dobsonville", lat: -26.2160, lng: 27.8720 },
  { street: "Koma St", area: "Jabulani", lat: -26.2500, lng: 27.8590 },
  { street: "Elias Motsoaledi Rd", area: "Dobsonville", lat: -26.2190, lng: 27.8650 },
  { street: "Tsietsi Mashinini St", area: "Jabavu", lat: -26.2550, lng: 27.8700 },
  { street: "Ntsane St", area: "Mofolo", lat: -26.2380, lng: 27.8820 },
  { street: "Xuma St", area: "Orlando West", lat: -26.2360, lng: 27.8960 },
  { street: "Motlana St", area: "Orlando West", lat: -26.2400, lng: 27.8980 },
  { street: "Sisulu St", area: "Orlando West", lat: -26.2330, lng: 27.8910 },
  { street: "Letanka St", area: "Orlando East", lat: -26.2230, lng: 27.9100 },
  { street: "Sofasonke St", area: "Orlando East", lat: -26.2310, lng: 27.9150 },
  { street: "Bolani Rd", area: "Jabulani", lat: -26.2480, lng: 27.8550 },
  { street: "Diokane St", area: "Jabulani", lat: -26.2530, lng: 27.8630 },
  { street: "Mlangeni Street", area: "Jabulani", lat: -26.2520, lng: 27.8620 },
  { street: "Hadebe St", area: "Jabavu", lat: -26.2560, lng: 27.8750 },
  { street: "Kunene St", area: "Meadowlands", lat: -26.2470, lng: 27.8710 },
  { street: "Ndaba St", area: "Meadowlands", lat: -26.2430, lng: 27.8660 },
  { street: "Mbatha St", area: "Diepkloof", lat: -26.2610, lng: 27.9250 },
  { street: "Dlamini St", area: "Diepkloof", lat: -26.2650, lng: 27.9300 },
];
const names = [
  "Casious Mookamedi", "Thandi Mokoena", "Sipho Dlamini", "Naledi Khumalo",
  "Refilwe Mahlangu", "Tebogo Mathebula", "Lerato Ncube", "Kgomotso Phiri",
  "Mpho Sibanda", "Zanele Nkosi", "Bongani Mthembu", "Palesa Radebe",
  "Tshepo Maluleke", "Nomvula Zungu", "Kabelo Letsoalo", "Dineo Molefe",
  "Andile Cele", "Khanyisile Vilakazi", "Sibusiso Hadebe", "Lindiwe Mabaso",
  "Tumelo Sithole", "Boipelo Khoza", "Mandla Buthelezi", "Precious Maseko",
];

const statuses: MeterStatus[] = [
  "normal","normal","normal","normal","normal","normal","normal","normal","normal","normal",
  "normal","normal","normal","normal","warning","warning","warning","warning",
  "critical","critical","critical","offline","offline","normal",
];

export const meters: Meter[] = Array.from({ length: 24 }, (_, i) => {
  const status = statuses[i];
  const baseline = 1800 + Math.floor(Math.random() * 600);
  
  const loc = actualLocations[i % actualLocations.length];

  return {
    id: `NXM-${String(i + 1).padStart(3, "0")}-SOW`,
    address: `${10 + i} ${loc.street}, ${loc.area}`,
    area: loc.area,
    consumerName: names[i],
    consumerPhone: `+27 8${i % 10} 555 ${1000 + i}`,
    status,
    currentDraw: status === "offline" ? 0 :
      status === "critical" ? baseline * 1.65 :
      status === "warning" ? baseline * 1.32 :
      baseline * (0.85 + Math.random() * 0.2),
    baselineWatts: baseline,
    deviationThreshold: 45,
    lastSeenAt: new Date(Date.now() - (status === "offline" ? 3600_000 * 4 : Math.random() * 60_000)).toISOString(),
    tamperEvents: status === "critical" ? 3 + Math.floor(Math.random() * 4) :
                  status === "warning" ? 1 + Math.floor(Math.random() * 2) : 0,
    installedAt: new Date(Date.now() - 365 * 24 * 3600_000 * (1 + Math.random() * 3)).toISOString(),
    hardwareVersion: "NX-Gateway v2.1",
    firmwareVersion: "1.4.7",
    lat: loc.lat,
    lng: loc.lng,
  };
});

export const usageHistory = (meterId: string) => {
  const seed = meterId.charCodeAt(4) || 1;
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    date: new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10),
    kWh: 12 + Math.sin((i + seed) * 0.7) * 4 + Math.random() * 3,
    hadTamper: Math.random() < 0.08,
  }));
};

export const hourlyUsageToday = () =>
  Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    kWh: 0.5 + Math.abs(Math.sin(h * 0.4)) * 2.5 + (h >= 17 && h <= 21 ? 1.8 : 0) + Math.random() * 0.3,
  }));
