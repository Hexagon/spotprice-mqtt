import { Client } from "https://deno.land/x/mqtt@0.1.2/deno/mod.ts";
import { config } from "./config.js";
import { logAndExit, logger } from "./logger.js";
import { avgPriceBetween, findMinMaxPriceAtDate, findPriceAt } from "./filters.js";

const spotprice = async (area, currency, inDate) => {
  const 
    baseUrl = "https://spot.56k.guru/api",
    entsoeEndpoint = "/entsoe",
    exrateEndpoint = "/exrate",
    params = {
      period: "hourly",
      date: inDate.toLocaleDateString('sv-SE'),
      area: area
    },
    entsoeUrl = `${baseUrl}${entsoeEndpoint}?${new URLSearchParams(params)}`,
    exrateUrl = `${baseUrl}${exrateEndpoint}`,
    entsoeResult = await fetch(entsoeUrl),
    entsoeJson = await entsoeResult.json();
    entsoeJson.data = entsoeJson.data.filter(e => new Date(e.startTime).toLocaleDateString('sv-SE') === inDate.toLocaleDateString('sv-SE'));
  if (currency !== "EUR") {
    const
      exrateResult = await fetch(exrateUrl),
      exrateJson = exrateResult.json(),
      currencyClean = currency.toUpperCase().trim();
    for(const e of entsoeJson.data) {
      e.spotPrice = e.spotPrice / extrateJson.data.entries[currencyClean];
      e.unit = e.unit.replace("EUR", currencyClean);
    }
  }
  return entsoeJson.data;
}

// Some nice constants!
const oneHourMs = 3600 * 1000,
  oneDayMs = oneHourMs * 24;

// Start by checking that MQTT service is available
let client;
try {
  // Start timeout timer
  const connectionTimeout = setTimeout(() => {
    if (connectionTimeout) {
      logger("Connection timed out");
      Deno.exit(1);
    }
  }, config.connectionTimeoutMs);

  // Try to connect
  client = new Client({ url: `mqtt://${config.host}:${config.port}` });
  await client.connect();

  // If we got here, all is good, clear timeout timer
  clearTimeout(connectionTimeout);
} catch (e) {
  // Oh cra...
  logAndExit("failed to connect " + e.toString(), 1);
}

// Fetch the data
let result;
try {
  result = [
    ...await spotprice(config.area, config.currency, new Date(new Date().getTime() - oneDayMs)),
    ...await spotprice(config.area, config.currency, new Date()),
    ...await spotprice(config.area, config.currency, new Date(new Date().getTime() + oneDayMs)),
  ];
} catch (e) {
  logAndExit("failed to fetch " + e.toString(), 1);
}

async function publishDevice(name, id, state, type) {
  if (type !== "json") {
    logger("publishing " + name + " " + state);
  } else {
    logger("publishing " + name + " [json]");
  }
  const stateTopic = config.topic + id + "/state",
    attributesTopic = config.topic + id + "/attributes",
    configTopic = config.topic + id + "/config";
  let deviceConfig;
  if (type === "monetary") {
    deviceConfig = {
      device_class: "monetary",
      name: name,
      state_topic: stateTopic,
      unit_of_measurement: config.currency + "/kWh",
      object_id: id,
    };
  } else if (type === "json") {
    deviceConfig = {
      name: name,
      state_topic: stateTopic,
      json_attributes_topic: attributesTopic,
      object_id: id,
    };
  } else {
    deviceConfig = {
      name: name,
      state_topic: stateTopic,
      object_id: id,
    };
  }
  try {
    await client.publish(configTopic, JSON.stringify(deviceConfig));
    if (type == "json") {
      await client.publish(stateTopic, "");
      await client.publish(attributesTopic, state);
    } else {
      await client.publish(stateTopic, state);
    }
    await client.publish(stateTopic, state);
  } catch (e) {
    logger("failed to publish " + e.toString());
    Deno.exit(1);
  }
}

// Generate a Date which represents 00:00:00 today
const dateToday = new Date(new Date().getTime());
dateToday.setHours(0);
dateToday.setMinutes(0);
dateToday.setSeconds(0);

// Generate a Date which represents 00:00:00 tomorrow
// - add an extra 7200 ms to make sure we land at tomorrow even after DST switches and such
const dateTomorrow = new Date(dateToday.getTime() + oneDayMs + 7200*1000);
dateTomorrow.setHours(0);
dateTomorrow.setMinutes(0);
dateTomorrow.setSeconds(0);

// Find extremes in result set
const extremesToday = findMinMaxPriceAtDate(result, new Date()),
  extremesTomorrow = findMinMaxPriceAtDate(result, dateTomorrow);

// Convenience function which applies extra costs to the spotprice
function preparePrice(price) {
  if (price !== null) {
    // Add price first - befora applying the price factor
    price = ((price / 1000) + config.extra) * config.factor;

    // ... Allow reducing the number of decials
    return price ? price.toFixed(config.decimals) : "";
  } else {
    return "";
  }
}

// Ok, ready to publish
await publishDevice("Average spot price today", config.entity + "_avg", preparePrice(avgPriceBetween(result, dateToday, 0, oneHourMs * 24)), "monetary");

await publishDevice(
  "Spot price data",
  config.entity + "_data",
  JSON.stringify({
    history: result.map((r) => {
      return { st: r.startTime, p: preparePrice(r.spotPrice) };
    }),
  }),
  "json",
);

await client.disconnect();
