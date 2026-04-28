#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const zlib = require("zlib");

const [date, from, to, output] = process.argv.slice(2);

if (!date || !from || !to || !output) {
  console.error("usage: query_left_ticket.js <YYYY-MM-DD> <FROM_CODE> <TO_CODE> <output.json>");
  process.exit(1);
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

async function main() {
  const init = await httpGet("https://kyfw.12306.cn/otn/leftTicket/init");
  const cookie = (init.res.headers["set-cookie"] || [])
    .map((item) => item.split(";")[0])
    .join("; ");
  const params = new URLSearchParams({
    "leftTicketDTO.train_date": date,
    "leftTicketDTO.from_station": from,
    "leftTicketDTO.to_station": to,
    purpose_codes: "ADULT",
  });

  let body = "";
  for (const endpoint of ["queryG", "query"]) {
    const url = `https://kyfw.12306.cn/otn/leftTicket/${endpoint}?${params.toString()}`;
    const res = await httpGet(url, {
      Cookie: cookie,
      Referer: "https://kyfw.12306.cn/otn/leftTicket/init",
    });
    body = res.body;
    try {
      const parsed = JSON.parse(body);
      if (!parsed.status || !parsed.data || !Array.isArray(parsed.data.result)) {
        continue;
      }
      fs.writeFileSync(output, JSON.stringify(parsed));
      return;
    } catch (_err) {
      continue;
    }
  }
  throw new Error(`query failed for ${date} ${from} -> ${to}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
