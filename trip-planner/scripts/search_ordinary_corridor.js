#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const zlib = require("zlib");

const TZ = "+08:00";
const DEFAULT_FIRST_DATES = ["2026-04-30"];
const DEFAULT_SECOND_DATES = ["2026-05-01"];
const DEFAULT_ARRIVAL_DEADLINE = `2026-05-01T23:59:59${TZ}`;

const ORIGINS = [
  { name: "深圳", code: "SZQ" },
  { name: "深圳北", code: "IOQ" },
  { name: "深圳东", code: "BJQ" },
  { name: "深圳坪山", code: "IFQ" },
  { name: "东莞", code: "RTQ" },
  { name: "东莞东", code: "DMQ" },
  { name: "惠州", code: "HCQ" },
  { name: "惠州西", code: "VXQ" },
  { name: "增城", code: "ZCA" },
  { name: "佛山", code: "FSQ" },
  { name: "广州", code: "GZQ" },
  { name: "广州东", code: "GGQ" },
  { name: "广州白云", code: "GBA" },
  { name: "佛山西", code: "FOQ" },
];

const SINKS = [
  { name: "常州", code: "CZH", city: "常州", final: true },
  { name: "无锡", code: "WXH", city: "无锡" },
  { name: "苏州", code: "SZH", city: "苏州" },
  { name: "上海", code: "SHH", city: "上海" },
  { name: "南京", code: "NJH", city: "南京" },
  { name: "镇江", code: "ZJH", city: "镇江" },
  { name: "丹阳", code: "DYH", city: "丹阳" },
  { name: "嘉兴", code: "JXH", city: "嘉兴" },
  { name: "杭州", code: "HZH", city: "杭州" },
  { name: "湖州", code: "VZH", city: "湖州" },
  { name: "合肥", code: "HFH", city: "合肥" },
  { name: "芜湖", code: "WHH", city: "芜湖" },
  { name: "宣城", code: "ECH", city: "宣城" },
  { name: "马鞍山", code: "MAH", city: "马鞍山" },
  { name: "蚌埠", code: "BBH", city: "蚌埠" },
  { name: "南昌", code: "NCG", city: "南昌" },
  { name: "常熟", code: "CAU", city: "常熟" },
  { name: "昆山", code: "KSH", city: "昆山" },
];

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

const ORDINARY_PREFIX = /^(K|T|Z|Y|L|\d)/;
const FINAL_CODES = new Set(["CZH", "ESH", "WJU", "JTU", "QYH"]);

function parseStationNames() {
  const raw = fs.readFileSync("/tmp/station_name.js", "utf8");
  const data = raw.match(/var station_names ='(.*)';/s)[1];
  const map = new Map();
  for (const item of data.split("@")) {
    if (!item) continue;
    const parts = item.split("|");
    map.set(parts[2], parts[1]);
  }
  return map;
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          Accept: "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          ...headers,
        },
      },
      (res) => {
        let stream = res;
        const encoding = res.headers["content-encoding"];
        if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
        if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () =>
          resolve({ res, body: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.on("error", reject);
  });
}

async function queryLeftTicket(cookie, date, from, to) {
  const params = new URLSearchParams({
    "leftTicketDTO.train_date": date,
    "leftTicketDTO.from_station": from,
    "leftTicketDTO.to_station": to,
    purpose_codes: "ADULT",
  });
  for (const endpoint of ["queryG", "query"]) {
    const url = `https://kyfw.12306.cn/otn/leftTicket/${endpoint}?${params.toString()}`;
    const { body } = await httpGet(url, {
      Cookie: cookie,
      Referer: "https://kyfw.12306.cn/otn/leftTicket/init",
    });
    if (!body) continue;
    try {
      const parsed = JSON.parse(body);
      if (!parsed.status || !parsed.data || !Array.isArray(parsed.data.result)) {
        continue;
      }
      return parsed;
    } catch (_err) {
      continue;
    }
  }
  throw new Error(`12306 query failed for ${from} -> ${to} on ${date}`);
}

async function getCookieJar() {
  const { res } = await httpGet("https://kyfw.12306.cn/otn/leftTicket/init");
  const cookies = res.headers["set-cookie"] || [];
  return cookies.map((item) => item.split(";")[0]).join("; ");
}

function parseDateTime(date, time) {
  return new Date(`${date}T${time}:00${TZ}`);
}

function parseMinutes(text) {
  const [h, m] = text.split(":").map(Number);
  return h * 60 + m;
}

function normalizeSeat(raw) {
  if (!raw) return null;
  if (raw === "无") return 0;
  if (raw === "有") return 99;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseFareBlocks(raw) {
  if (!raw) return [];
  const out = [];
  for (let i = 0; i + 10 <= raw.length; i += 10) {
    out.push({ code: raw[i], value: Number(raw.slice(i + 1, i + 10)) / 100000 });
  }
  return out;
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

function mapSeatFares(blocks) {
  return {
    商务座: takeBlock(blocks, "9"),
    一等座: takeBlock(blocks, "M"),
    二等座: takeBlock(blocks, "O"),
    无座: takeBlock(blocks, "O", 2) ?? takeBlock(blocks, "1"),
    硬座: takeBlock(blocks, "1"),
    硬卧: takeBlock(blocks, "3"),
    软卧: takeBlock(blocks, "4"),
    软座: takeBlock(blocks, "2"),
    特等座: takeBlock(blocks, "P"),
    高级软卧: takeBlock(blocks, "6"),
  };
}

function parseTrain(raw, stationMap) {
  const parts = raw.split("|");
  const seats = {};
  for (const [name, idx] of Object.entries(SEAT_INDEXES)) {
    seats[name] = normalizeSeat(parts[idx]);
  }
  const fareBlocks = parseFareBlocks(parts[39] || "");
  const fares = mapSeatFares(fareBlocks);
  const departure = parseDateTime(
    `${parts[13].slice(0, 4)}-${parts[13].slice(4, 6)}-${parts[13].slice(6, 8)}`,
    parts[8]
  );
  const arrival = new Date(departure.getTime() + parseMinutes(parts[10]) * 60 * 1000);
  return {
    trainNo: parts[3],
    canBook: parts[1] === "预订" && parts[11] === "Y",
    fromCode: parts[6],
    toCode: parts[7],
    fromStation: stationMap.get(parts[6]) || parts[6],
    toStation: stationMap.get(parts[7]) || parts[7],
    departure,
    arrival,
    duration: parts[10],
    seats,
    fares,
  };
}

function cheapestSeat(train, ordinaryOnly = false) {
  const order = ordinaryOnly
    ? ["无座", "硬座", "硬卧", "软座", "软卧"]
    : ["无座", "硬座", "硬卧", "二等座", "一等座", "软卧", "商务座"];
  const candidates = [];
  for (const seatName of order) {
    const seatCount = train.seats[seatName];
    const fare = train.fares[seatName];
    if (typeof seatCount === "number" && seatCount > 0 && typeof fare === "number" && fare > 0) {
      candidates.push({ seatName, seatCount, fare });
    }
  }
  candidates.sort((a, b) => a.fare - b.fare);
  return candidates[0] || null;
}

function leaveCost(departure) {
  const hour = departure.getHours();
  const minute = departure.getMinutes();
  const hm = hour * 60 + minute;
  if (hm >= 18 * 60) return 0;
  if (hm >= 13 * 60) return 500;
  return 1000;
}

function transferBufferMinutes(city, arrivalStation, nextDepartureStation) {
  if (arrivalStation === nextDepartureStation) return 20;
  if (city === "上海") return 60;
  if (city === "南京") return 45;
  return 30;
}

async function main() {
  const args = new Map(
    process.argv.slice(2).map((item) => {
      const [k, v] = item.split("=");
      return [k, v];
    })
  );
  const firstDates = (args.get("--first-dates") || DEFAULT_FIRST_DATES.join(","))
    .split(",")
    .filter(Boolean);
  const secondDates = (args.get("--second-dates") || DEFAULT_SECOND_DATES.join(","))
    .split(",")
    .filter(Boolean);
  const arrivalDeadline = new Date(
    args.get("--arrival-deadline") || DEFAULT_ARRIVAL_DEADLINE
  );
  const stationMap = parseStationNames();
  const cookie = await getCookieJar();

  const firstLegs = [];
  for (const date of firstDates) {
    for (const origin of ORIGINS) {
      for (const sink of SINKS) {
        try {
          const data = await queryLeftTicket(cookie, date, origin.code, sink.code);
          const results = data.data?.result || [];
          for (const raw of results) {
            const train = parseTrain(raw, stationMap);
            if (!ORDINARY_PREFIX.test(train.trainNo)) continue;
            if (!train.canBook) continue;
            if (train.arrival > arrivalDeadline) continue;
            const seat = cheapestSeat(train, true);
            if (!seat) continue;
            firstLegs.push({
              searchDate: date,
              origin,
              sink,
              trainNo: train.trainNo,
              fromStation: train.fromStation,
              toStation: train.toStation,
              departure: train.departure,
              arrival: train.arrival,
              duration: train.duration,
              seatName: seat.seatName,
              seatCount: seat.seatCount,
              fare: seat.fare,
              leaveCost: leaveCost(train.departure),
            });
          }
        } catch (_err) {
          continue;
        }
      }
    }
  }

  const secondLegBySink = new Map();
  for (const sink of SINKS.filter((x) => !x.final)) {
    const legs = [];
    for (const date of secondDates) {
      try {
        const data = await queryLeftTicket(cookie, date, sink.code, "CZH");
        const results = data.data?.result || [];
        for (const raw of results) {
          const train = parseTrain(raw, stationMap);
          if (!train.canBook) continue;
          if (!FINAL_CODES.has(train.toCode)) continue;
          if (train.arrival > arrivalDeadline) continue;
          const seat = cheapestSeat(train, false);
          if (!seat) continue;
          legs.push({
            searchDate: date,
            trainNo: train.trainNo,
            fromStation: train.fromStation,
            toStation: train.toStation,
            departure: train.departure,
            arrival: train.arrival,
            seatName: seat.seatName,
            seatCount: seat.seatCount,
            fare: seat.fare,
          });
        }
      } catch (_err) {
        continue;
      }
    }
    secondLegBySink.set(sink.code, legs);
  }

  const plans = [];
  for (const leg of firstLegs) {
    if (leg.sink.final || FINAL_CODES.has(leg.toStation)) {
      plans.push({
        mode: "direct-ordinary",
        totalCost: leg.fare + leg.leaveCost,
        firstLeg: leg,
      });
      continue;
    }
    const options = secondLegBySink.get(leg.sink.code) || [];
    const valid = options
      .filter((second) => {
        const buffer = transferBufferMinutes(leg.sink.city, leg.toStation, second.fromStation);
        return second.departure.getTime() >= leg.arrival.getTime() + buffer * 60 * 1000;
      })
      .sort((a, b) => a.fare - b.fare || a.arrival - b.arrival);
    if (!valid[0]) continue;
    plans.push({
      mode: "ordinary-plus-short",
      totalCost: leg.fare + leg.leaveCost + valid[0].fare,
      firstLeg: leg,
      secondLeg: valid[0],
    });
  }

  plans.sort((a, b) => a.totalCost - b.totalCost || a.firstLeg.arrival - b.firstLeg.arrival);

  const bestByOriginSink = new Map();
  for (const plan of plans) {
    const key = `${plan.firstLeg.origin.name}->${plan.firstLeg.sink.city}`;
    if (!bestByOriginSink.has(key)) bestByOriginSink.set(key, plan);
  }

  process.stdout.write(
    JSON.stringify(
      {
        searchedOrigins: ORIGINS.map((x) => x.name),
        searchedSinks: SINKS.map((x) => x.city),
        firstDates,
        secondDates,
        arrivalDeadline: arrivalDeadline.toISOString(),
        topPlans: plans.slice(0, 30),
        bestByOriginSink: [...bestByOriginSink.values()].slice(0, 30),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
