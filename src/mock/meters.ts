import type { Meter, MeterStatus } from "@/types";

const actualLocations = [
  { street: "Vilakazi St", area: "Orlando West", lat: -26.2384, lng: 27.9051 },
  { street: "Chris Hani Rd", area: "Diepkloof", lat: -26.257, lng: 27.915 },
  { street: "Modjadji St", area: "Meadowlands", lat: -26.252, lng: 27.876 },
  { street: "Mncube Dr", area: "Dube", lat: -26.242, lng: 27.89 },
  { street: "Kumalo St", area: "Orlando East", lat: -26.229, lng: 27.904 },
  { street: "Mahalefele Rd", area: "Dube", lat: -26.232, lng: 27.88 },
  { street: "Roodepoort Rd", area: "Dobsonville", lat: -26.216, lng: 27.872 },
  { street: "Koma St", area: "Jabulani", lat: -26.25, lng: 27.859 },
  { street: "Elias Motsoaledi Rd", area: "Dobsonville", lat: -26.219, lng: 27.865 },
  { street: "Tsietsi Mashinini St", area: "Jabavu", lat: -26.255, lng: 27.87 },
  { street: "Ntsane St", area: "Mofolo", lat: -26.238, lng: 27.882 },
  { street: "Xuma St", area: "Orlando West", lat: -26.236, lng: 27.896 },
  { street: "Motlana St", area: "Orlando West", lat: -26.24, lng: 27.898 },
  { street: "Sisulu St", area: "Orlando West", lat: -26.233, lng: 27.891 },
  { street: "Letanka St", area: "Orlando East", lat: -26.223, lng: 27.91 },
  { street: "Sofasonke St", area: "Orlando East", lat: -26.231, lng: 27.915 },
  { street: "Bolani Rd", area: "Jabulani", lat: -26.248, lng: 27.855 },
  { street: "Diokane St", area: "Jabulani", lat: -26.253, lng: 27.863 },
  { street: "Mlangeni Street", area: "Jabulani", lat: -26.252, lng: 27.862 },
  { street: "Hadebe St", area: "Jabavu", lat: -26.256, lng: 27.875 },
  { street: "Kunene St", area: "Meadowlands", lat: -26.247, lng: 27.871 },
  { street: "Ndaba St", area: "Meadowlands", lat: -26.243, lng: 27.866 },
  { street: "Mbatha St", area: "Diepkloof", lat: -26.261, lng: 27.925 },
  { street: "Dlamini St", area: "Diepkloof", lat: -26.265, lng: 27.93 },
];
const names = [
  "Casious Mookamedi",
  "Thandi Mokoena",
  "Sipho Dlamini",
  "Naledi Khumalo",
  "Refilwe Mahlangu",
  "Tebogo Mathebula",
  "Lerato Ncube",
  "Kgomotso Phiri",
  "Mpho Sibanda",
  "Zanele Nkosi",
  "Bongani Mthembu",
  "Palesa Radebe",
  "Tshepo Maluleke",
  "Nomvula Zungu",
  "Kabelo Letsoalo",
  "Dineo Molefe",
  "Andile Cele",
  "Khanyisile Vilakazi",
  "Sibusiso Hadebe",
  "Lindiwe Mabaso",
  "Tumelo Sithole",
  "Boipelo Khoza",
  "Mandla Buthelezi",
  "Precious Maseko",
];

const statuses: MeterStatus[] = [
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "warning",
  "warning",
  "warning",
  "warning",
  "critical",
  "critical",
  "critical",
  "offline",
  "offline",
  "normal",
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
    currentDraw:
      status === "offline"
        ? 0
        : status === "critical"
          ? baseline * 1.65
          : status === "warning"
            ? baseline * 1.32
            : baseline * (0.85 + Math.random() * 0.2),
    baselineWatts: baseline,
    deviationThreshold: 45,
    lastSeenAt: new Date(
      Date.now() - (status === "offline" ? 3600_000 * 4 : Math.random() * 60_000),
    ).toISOString(),
    tamperEvents:
      status === "critical"
        ? 3 + Math.floor(Math.random() * 4)
        : status === "warning"
          ? 1 + Math.floor(Math.random() * 2)
          : 0,
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
    kWh:
      0.5 +
      Math.abs(Math.sin(h * 0.4)) * 2.5 +
      (h >= 17 && h <= 21 ? 1.8 : 0) +
      Math.random() * 0.3,
  }));
