#!/usr/bin/env node

const fs = require("fs");

const data = JSON.parse(
  fs.readFileSync("/tmp/ordinary-corridor-2026-04-30.json", "utf8")
);

const ORDINARY_PREFIX = /^(K|T|Z|Y|L|\d)/;

function isOrdinaryTrain(trainNo) {
  return ORDINARY_PREFIX.test(trainNo || "");
}

function fmt(iso) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

const dedup = new Set();
const rows = [];

for (const plan of data.topPlans) {
  const first = plan.firstLeg;
  const second = plan.secondLeg;
  if (!isOrdinaryTrain(first.trainNo)) continue;
  if (second && !isOrdinaryTrain(second.trainNo)) continue;
  const key = [
    plan.mode,
    first.trainNo,
    first.fromStation,
    first.toStation,
    second?.trainNo || "",
    second?.fromStation || "",
    second?.toStation || "",
  ].join("|");
  if (dedup.has(key)) continue;
  dedup.add(key);
  rows.push({
    totalCost: +plan.totalCost.toFixed(1),
    leaveCost: first.leaveCost,
    cashFare: +(
      first.fare + (second ? second.fare : 0)
    ).toFixed(1),
    origin: first.origin.name,
    path: second
      ? `${first.fromStation} -> ${first.toStation} -> ${second.toStation}`
      : `${first.fromStation} -> ${first.toStation}`,
    firstTrain: `${first.trainNo} ${fmt(first.departure)} / ${fmt(first.arrival)} ${first.seatName} ${first.seatCount} ¥${(+first.fare.toFixed(1))}`,
    secondTrain: second
      ? `${second.trainNo} ${fmt(second.departure)} / ${fmt(second.arrival)} ${second.seatName} ${second.seatCount} ¥${(+second.fare.toFixed(1))}`
      : null,
  });
}

rows.sort((a, b) => a.totalCost - b.totalCost);
process.stdout.write(JSON.stringify(rows, null, 2));
