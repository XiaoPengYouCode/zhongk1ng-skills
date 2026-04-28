#!/usr/bin/env node

const fs = require("fs");

const DEFAULT_END_OF_DAY = new Date("2026-05-01T23:59:59+08:00");
const MIN_TRANSFER_MS = 90 * 60 * 1000;
const FLIGHT_TAX_BY_CITY = {
  常州: 170,
  上海: 170,
  南京: 170,
  无锡: 170,
  杭州: 170,
  宁波: 170,
  南昌: 110,
};
const TRANSFER_RULES = [
  { city: "上海", airport: "浦东", stationPrefix: "上海虹桥", minMinutes: 150, cost: 8 },
  { city: "上海", airport: "浦东", stationPrefix: "上海", minMinutes: 120, cost: 7 },
  { city: "上海", airport: "虹桥", stationPrefix: "上海虹桥", minMinutes: 45, cost: 0 },
  { city: "上海", airport: "虹桥", stationPrefix: "上海", minMinutes: 75, cost: 5 },
  { city: "南京", airport: "禄口", stationPrefix: "南京", minMinutes: 90, cost: 7 },
  { city: "无锡", airport: "硕放", stationPrefix: "无锡", minMinutes: 90, cost: 5 },
  { city: "杭州", airport: "萧山", stationPrefix: "杭州", minMinutes: 90, cost: 8 },
  { city: "宁波", airport: "栎社", stationPrefix: "宁波", minMinutes: 90, cost: 4 },
  { city: "南昌", airport: "昌北", stationPrefix: "南昌", minMinutes: 90, cost: 6 },
];

const CACHE = {
  rail: {
    "深圳-常州-2026-04-30": "/tmp/sz-cz-2026-04-30.json",
    "深圳-常州-2026-05-01": "/tmp/sz-cz-2026-05-01.json",
    "上海虹桥-常州-2026-05-01": "/tmp/shhq-cz-2026-05-01-full.json",
    "上海虹桥-常州-2026-05-02": "/tmp/shhq-cz-2026-05-02.json",
    "南京-常州-2026-05-01": "/tmp/nj-cz-2026-05-01.json",
    "南京-常州-2026-05-02": "/tmp/nkh-cz-2026-05-02.json",
    "无锡-常州-2026-05-01": "/tmp/wx-cz-2026-05-01.json",
    "无锡-常州-2026-05-02": "/tmp/wx-cz-2026-05-02.json",
    "杭州-常州-2026-05-01": "/tmp/hgh-cz-2026-05-01.json",
    "杭州-常州-2026-05-02": "/tmp/hgh-cz-2026-05-02.json",
    "宁波-常州-2026-05-01": "/tmp/ngh-cz-2026-05-01.json",
    "宁波-常州-2026-05-02": "/tmp/ngh-cz-2026-05-02.json",
    "马鞍山-常州-2026-05-01": "/tmp/maanshan-cz-2026-05-01.json",
    "南昌-常州-2026-05-02": "/tmp/ncg-cz-2026-05-02.json",
  },
  flight: {
    上海: "/tmp/flight-e94e8bd35fc8144f38fd1ebc1f81ab36.json",
    南京: "/tmp/flight-ad827c5906e6097904964bf48d70a06d.json",
    无锡: "/tmp/flight-cc6b473b7ea2f23546d0361573b98b30.json",
    杭州: "/tmp/flight-69d6beffab0807555951e7f947224de3.json",
    宁波: "/tmp/flight-ed5a4dc7333c6ac8b5ab91a6a8a917ac.json",
  },
  inlineFlights: {
    常州: [
      {
        airlineCompany: "深航",
        flightNumber: "ZH8927",
        departureTime: "2026-05-01 19:25",
        arrivalTime: "2026-05-01 21:45",
        departureAirport: "宝安",
        departureTerminal: "T3",
        arrivalAirport: "奔牛",
        arrivalTerminal: "",
        remainingSeats: "9",
        basePrice: "1140",
      },
      {
        airlineCompany: "南航",
        flightNumber: "CZ3351",
        departureTime: "2026-05-01 07:05",
        arrivalTime: "2026-05-01 09:20",
        departureAirport: "宝安",
        departureTerminal: "T3",
        arrivalAirport: "奔牛",
        arrivalTerminal: "",
        remainingSeats: "9",
        basePrice: "1350",
      },
      {
        airlineCompany: "深航",
        flightNumber: "ZH8925",
        departureTime: "2026-05-01 07:05",
        arrivalTime: "2026-05-01 09:25",
        departureAirport: "宝安",
        departureTerminal: "T3",
        arrivalAirport: "奔牛",
        arrivalTerminal: "",
        remainingSeats: "9",
        basePrice: "1350",
      },
      {
        airlineCompany: "南航",
        flightNumber: "CZ8503",
        departureTime: "2026-05-01 21:45",
        arrivalTime: "2026-05-02 00:15",
        departureAirport: "宝安",
        departureTerminal: "T3",
        arrivalAirport: "奔牛",
        arrivalTerminal: "",
        remainingSeats: "9",
        basePrice: "850",
      },
    ],
    南昌: [
      {
        airlineCompany: "深航",
        flightNumber: "ZH8861",
        departureTime: "2026-05-01 22:10",
        arrivalTime: "2026-05-01 23:50",
        departureAirport: "宝安",
        departureTerminal: "T3",
        arrivalAirport: "昌北",
        arrivalTerminal: "T2",
        remainingSeats: "6",
        basePrice: "860",
      },
    ],
  },
};

const SEAT_INDEXES = {
  高级软卧: 21,
  软卧: 23,
  软座: 24,
  特等座: 25,
  无座: 26,
  硬卧: 28,
  硬座: 29,
  二等座: 30,
  一等座: 31,
  商务座: 32,
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseDateTime(value) {
  return new Date(value.replace(" ", "T") + "+08:00");
}

function parseMinutes(durationText) {
  const parts = durationText.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function normalizeSeat(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw === "无") return 0;
  if (raw === "有") return 99;
  if (raw.startsWith("*")) return raw;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseRailResult(rawString, stationMap) {
  const parts = rawString.split("|");
  const fareBlocks = parseFareBlocks(parts[39] || "");
  const seats = {};
  for (const [name, index] of Object.entries(SEAT_INDEXES)) {
    seats[name] = normalizeSeat(parts[index]);
  }
  return {
    trainNo: parts[3],
    canBook: parts[1] === "预订" && parts[11] === "Y",
    fromCode: parts[6],
    toCode: parts[7],
    fromStation: stationMap[parts[6]] || parts[6],
    toStation: stationMap[parts[7]] || parts[7],
    departureTime: parts[8],
    arrivalTime: parts[9],
    durationText: parts[10],
    durationMinutes: parseMinutes(parts[10]),
    departureDate: parts[13],
    seats,
    fares: mapSeatFares(seats, fareBlocks),
    raw: rawString,
  };
}

function loadRailOptions(file) {
  if (!fs.existsSync(file)) return [];
  const data = readJson(file);
  const stationMap = data.data?.map || {};
  const results = data.data?.result || [];
  return results.map((item) => parseRailResult(item, stationMap));
}

function loadFlightOptions(file) {
  const data = readJson(file);
  const payload = JSON.parse(data.result.structuredContent.result);
  return payload.data;
}

function flightCityOptions() {
  const byCity = {};
  for (const [city, file] of Object.entries(CACHE.flight)) {
    byCity[city] = loadFlightOptions(file);
  }
  for (const [city, items] of Object.entries(CACHE.inlineFlights)) {
    byCity[city] = items;
  }
  return byCity;
}

function railDateTime(dateText, timeText) {
  const formatted = `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)} ${timeText}`;
  return parseDateTime(formatted);
}

function arrivalDateTimeForRail(dateText, departureTime, durationMinutes) {
  const departure = railDateTime(dateText, departureTime);
  return new Date(departure.getTime() + durationMinutes * 60 * 1000);
}

function seatPriority(option) {
  const candidates = Object.entries(option.seats)
    .map(([seatName, seatCount]) => {
      const fare = option.fares[seatName];
      return { seatName, seatCount, fare };
    })
    .filter((item) => typeof item.seatCount === "number" && item.seatCount > 0)
    .filter((item) => typeof item.fare === "number" && item.fare > 0)
    .sort((a, b) => a.fare - b.fare);
  return candidates[0] || null;
}

function directRailOptions() {
  const options = [];
  for (const [key, file] of Object.entries(CACHE.rail)) {
    if (!key.startsWith("深圳-常州-")) continue;
    const date = key.slice(-10);
    const leaveCost = date === "2026-04-30" ? 1000 : 0;
    for (const train of loadRailOptions(file)) {
      if (!train.canBook) continue;
      const seat = seatPriority(train);
      if (!seat) continue;
      const price = seat.fare;
      options.push({
        type: "direct-rail",
        date,
        trainNo: train.trainNo,
        fromStation: train.fromStation,
        toStation: train.toStation,
        departure: railDateTime(train.departureDate, train.departureTime),
        arrival: arrivalDateTimeForRail(
          train.departureDate,
          train.departureTime,
          train.durationMinutes
        ),
        seatName: seat.seatName,
        seatCount: seat.seatCount,
        fare: price,
        leaveCost,
        totalCost: price + leaveCost,
      });
    }
  }
  return options.sort((a, b) => a.totalCost - b.totalCost);
}

function stationKeyForCity(city) {
  const map = {
    上海: "上海虹桥-常州-2026-05-01",
    南京: "南京-常州-2026-05-01",
    无锡: "无锡-常州-2026-05-01",
    杭州: "杭州-常州-2026-05-01",
    宁波: "宁波-常州-2026-05-01",
    马鞍山: "马鞍山-常州-2026-05-01",
  };
  return map[city];
}

function bestConnectingRail(city, flight, endOfDay) {
  const railKeys = stationKeysForCity(city, flight.arrivalTime);
  const options = railKeys
    .flatMap((key) => loadRailOptions(CACHE.rail[key]))
    .filter((train) => train.canBook)
    .map((train) => {
      const seat = seatPriority(train);
      if (!seat) return null;
      const departure = railDateTime(train.departureDate, train.departureTime);
      const arrival = arrivalDateTimeForRail(
        train.departureDate,
        train.departureTime,
        train.durationMinutes
      );
      const transfer = transferRule(city, flight.arrivalAirport, train.fromStation);
      const earliestTrainDeparture = new Date(
        parseDateTime(flight.arrivalTime).getTime() +
          Math.max(MIN_TRANSFER_MS, transfer.minMinutes * 60 * 1000)
      );
      return {
        trainNo: train.trainNo,
        fromStation: train.fromStation,
        toStation: train.toStation,
        departure,
        arrival,
        seatName: seat.seatName,
        seatCount: seat.seatCount,
        fare: seat.fare,
        transfer,
        eligible: departure >= earliestTrainDeparture,
      };
    })
    .filter(Boolean)
    .filter((train) => train.eligible)
    .filter((train) => train.arrival <= endOfDay)
    .sort((a, b) => a.fare - b.fare || a.arrival - b.arrival);

  return options[0] || null;
}

function flightPlusRailOptions(endOfDay) {
  const all = [];
  const byCity = flightCityOptions();
  for (const [city, flights] of Object.entries(byCity)) {
    if (city === "常州") continue;
    const tax = FLIGHT_TAX_BY_CITY[city];
    for (const flight of flights) {
      const arrival = parseDateTime(flight.arrivalTime);
      if (arrival > endOfDay) continue;
      const departure = parseDateTime(flight.departureTime);
      const rail = bestConnectingRail(city, flight, endOfDay);
      if (!rail) continue;
      const basePrice = Number(flight.basePrice);
      all.push({
        type: "flight-plus-rail",
        city,
        flightNo: flight.flightNumber,
        airlineCompany: flight.airlineCompany,
        flightDeparture: departure,
        flightArrival: arrival,
        flightBase: basePrice,
        flightTax: tax,
        flightSeats: flight.remainingSeats,
        railTrainNo: rail.trainNo,
        railFrom: rail.fromStation,
        railTo: rail.toStation,
        railDeparture: rail.departure,
        railArrival: rail.arrival,
        railSeatName: rail.seatName,
        railSeatCount: rail.seatCount,
        railFare: rail.fare,
        transferCost: rail.transfer.cost,
        totalCost: basePrice + tax + rail.fare + rail.transfer.cost,
      });
    }
  }
  return all.sort((a, b) => a.totalCost - b.totalCost || a.railArrival - b.railArrival);
}

function directFlightOptions(endOfDay) {
  const flights = flightCityOptions().常州 || [];
  return flights
    .map((flight) => {
      const arrival = parseDateTime(flight.arrivalTime);
      if (arrival > endOfDay) return null;
      const basePrice = Number(flight.basePrice);
      const tax = FLIGHT_TAX_BY_CITY.常州;
      return {
        type: "direct-flight",
        flightNo: flight.flightNumber,
        airlineCompany: flight.airlineCompany,
        departure: parseDateTime(flight.departureTime),
        arrival,
        basePrice,
        tax,
        seats: flight.remainingSeats,
        totalCost: basePrice + tax,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.totalCost - b.totalCost);
}

function summarize(endOfDay) {
  return {
    directRail: directRailOptions(),
    directFlight: directFlightOptions(endOfDay),
    flightPlusRail: flightPlusRailOptions(endOfDay),
  };
}

if (require.main === module) {
  const endArg = process.argv
    .slice(2)
    .find((item) => item.startsWith("--arrival-deadline="));
  const endOfDay = endArg
    ? new Date(endArg.split("=")[1])
    : DEFAULT_END_OF_DAY;
  const result = summarize(endOfDay);
  process.stdout.write(JSON.stringify(result, null, 2));
}

function parseFareBlocks(raw) {
  if (!raw) return [];
  const blocks = [];
  for (let i = 0; i + 10 <= raw.length; i += 10) {
    const block = raw.slice(i, i + 10);
    const code = block[0];
    const value = Number(block.slice(1)) / 100000;
    blocks.push({ code, value });
  }
  return blocks;
}

function takeBlock(blocks, code, occurrence = 1) {
  let seen = 0;
  for (const block of blocks) {
    if (block.code !== code) continue;
    seen += 1;
    if (seen === occurrence) return block.value;
  }
  return null;
}

function mapSeatFares(seats, blocks) {
  const fares = {};
  fares.商务座 = takeBlock(blocks, "9");
  fares.一等座 = takeBlock(blocks, "M");
  fares.二等座 = takeBlock(blocks, "O");
  fares.无座 = takeBlock(blocks, "O", 2) ?? takeBlock(blocks, "1");
  fares.硬座 = takeBlock(blocks, "1");
  fares.硬卧 = takeBlock(blocks, "3");
  fares.软卧 = takeBlock(blocks, "4");
  fares.软座 = takeBlock(blocks, "2");
  fares.特等座 = takeBlock(blocks, "P");
  fares.高级软卧 = takeBlock(blocks, "6");
  return fares;
}

function transferRule(city, arrivalAirport, fromStation) {
  for (const rule of TRANSFER_RULES) {
    if (rule.city !== city) continue;
    if (!arrivalAirport.includes(rule.airport)) continue;
    if (!fromStation.startsWith(rule.stationPrefix)) continue;
    return rule;
  }
  return { minMinutes: 90, cost: 0 };
}

function stationKeysForCity(city, arrivalTimeText) {
  const arrival = parseDateTime(arrivalTimeText);
  const dates = [arrival, new Date(arrival.getTime() + 24 * 60 * 60 * 1000)]
    .map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  const prefixMap = {
    上海: "上海虹桥-常州-",
    南京: "南京-常州-",
    无锡: "无锡-常州-",
    杭州: "杭州-常州-",
    宁波: "宁波-常州-",
    马鞍山: "马鞍山-常州-",
    南昌: "南昌-常州-",
  };
  const prefix = prefixMap[city];
  if (!prefix) return [];
  return dates
    .map((date) => `${prefix}${date}`)
    .filter((key) => CACHE.rail[key]);
}
