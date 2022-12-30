import { Client } from "https://deno.land/x/mqtt@0.1.2/deno/mod.ts";
import { config } from "./config.js";
import { logAndExit, logger } from "./logger.js";
import { avgPriceBetween, findMinMaxPriceAtDate, findPriceAt } from "./filters.js";

const spotprice = async (area, currency, inDate) => {
  const 
    baseUrl = "https://spot.56k.guru/api/v2",
    entsoeEndpoint = "/spot",
    params = {
      period: "hourly",
      startDate: inDate.toLocaleDateString('sv-SE'),
      endDate: inDate.toLocaleDateString('sv-SE'),
      area,
      currency
    },
    entsoeUrl = `${baseUrl}${entsoeEndpoint}?${new URLSearchParams(params)}`,
    entsoeResult = await fetch(entsoeUrl),
    entsoeJson = await entsoeResult.json();
    entsoeJson.data = entsoeJson.data.map(({time,price}) => {return { time: new Date(Date.parse(time)),price}});
    return entsoeJson.data;
}

  // Some nice constants!
const oneHourMs = 3600 * 1000,
  oneDayMs
   = oneHourMs * 24;

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
  const publishOpts = {
    retain: true
  }
  try {
    await client.publish(configTopic, JSON.stringify(deviceConfig),publishOpts);
    if (type == "json") {
      await client.publish(stateTopic, "",publishOpts);
      await client.publish(attributesTopic, state,publishOpts);
    } else {
      await client.publish(stateTopic, state,publishOpts);
    }
    await client.publish(stateTopic, state,publishOpts);
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

// Find extremes in result set
const extremesToday = findMinMaxPriceAtDate(result, new Date()),
  extremesTomorrow = findMinMaxPriceAtDate(result, dateTomorrow);


// Ok, ready to publish
await publishDevice("Spot price now", config.entity + "_now", preparePrice(findPriceAt(result, new Date())), "monetary");
await publishDevice("Spot price in 1 hour", config.entity + "_1h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs))), "monetary");
await publishDevice("Spot price in 6 hours", config.entity + "_6h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs * 6))), "monetary");
await publishDevice("Spot price in 12 hours", config.entity + "_12h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs * 12))), "monetary");
await publishDevice("Highest upcomping spot price today ", config.entity + "_today_max", preparePrice(extremesToday.maxVal), "monetary");
await publishDevice("Highest upcomping spot price today time", config.entity + "_today_max_time", extremesToday.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price today", config.entity + "_today_min", preparePrice(extremesToday.minVal), "monetary");
await publishDevice("Lowest upcomping spot price today time", config.entity + "_today_min_time", extremesToday.minTime, "datetime");
await publishDevice("Highest upcomping spot price tomorrow", config.entity + "_tomorrow_max", preparePrice(extremesTomorrow.maxVal), "monetary");
await publishDevice("Highest upcomping spot price tomorrow time", config.entity + "_tomorrow_max_time", extremesTomorrow.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price tomorrow", config.entity + "_tomorrow_min", preparePrice(extremesTomorrow.minVal), "monetary");
await publishDevice("Lowest upcomping spot price tomorrow time", config.entity + "_tomorrow_min_time", extremesTomorrow.minTime, "datetime");
await publishDevice("Average spot price today", config.entity + "_avg", preparePrice(avgPriceBetween(result, dateToday, 0, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price today night", config.entity + "_night_avg", preparePrice(avgPriceBetween(result, dateToday, 0, oneHourMs * 6)), "monetary");
await publishDevice("Average spot price today morning", config.entity + "_morning_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 6, oneHourMs * 12)), "monetary");
await publishDevice("Average spot price today afternoon", config.entity + "_afternoon_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 12, oneHourMs * 18)), "monetary");
await publishDevice("Average spot price today evening", config.entity + "_evening_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 18, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price tomorrow", config.entity + "_tomorrow_avg", preparePrice(avgPriceBetween(result, dateTomorrow, 0, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price tomorrow night", config.entity + "_tomorrow_night_avg", preparePrice(avgPriceBetween(result, dateTomorrow, 0, oneHourMs * 6)), "monetary");
await publishDevice("Average spot price tomorrow morning", config.entity + "_tomorrow_morning_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 6, oneHourMs * 12)), "monetary");
await publishDevice("Average spot price tomorrow afternoon", config.entity + "_tomorrow_afternoon_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 12, oneHourMs * 18)), "monetary");
await publishDevice("Average spot price tomorrow evening", config.entity + "_tomorrow_evening_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 18, oneHourMs * 24)), "monetary");
await publishDevice("Spot price data", config.entity + "_data", JSON.stringify({
    history: result.map((r)=>{
        return {
            st: r.startTime,
            p: preparePrice(r.spotPrice)
        };
    })
}), "json");

await client.disconnect();
