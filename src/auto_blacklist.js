// const fetch = require('node-fetch');
// const puppeteer = require('puppeteer');
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// ----- START OF BLACKLIST FUNCTIONS -----
const lookupAlienVault = async (url) => {
  const headers = { 
    "X-OTX-API-KEY": process.env.ALIENVAULT_KEY ,
  };
  let submissionResponse = await fetch(`${process.env.ALIENVAULT_LOOKUP}${encodeURIComponent(url)}/general`, {
    method: "GET",
    headers,
  });
  const data = await submissionResponse.json();
    if (data.error) {
      console.log(data)
      return [false, null]
    }
  const pulse_count = data.pulse_info.count
  // console.log("Pulse Count:", pulse_count)
  console.log(`[LOOKUP OUTPUT] `, data)
  return [pulse_count > 0, pulse_count]
}

const toAlienVault = async (url) => {
  const body = { "url": url, "tlp": "white" };
  const headers = { 
    "X-OTX-API-KEY": process.env.ALIENVAULT_KEY ,
    "Content-Type": "application/json"
  };
  let submissionResponse = await fetch(process.env.ALIENVAULT_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  data = await submissionResponse.json()
  console.log(`Submission Response: `,data)
  return data.status == 'ok'
} 

const lookupYandexSafeBrowsing = async (url) => {
  const body = { 
    client: { clientId: "captcha-honeypot", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: url }]
    }
  };
  const headers = { "Content-Type": "application/json" };
  const apiUrl = `${process.env.YANDEX_SAFE_BROWSING_API}?key=${process.env.YANDEX_SAFE_BROWSING_KEY}`;
  let submissionResponse = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await submissionResponse.json();
  console.log(`[LOOKUP OUTPUT] `, data)
  return [Object.keys(data).length > 0, Object.keys(data).length]
}

const lookupGoogleSafeBrowsing = async (url) => {
  const body = { 
    client: { clientId: "captcha-honeypot", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: url }]
    }
  };
  const headers = { "Content-Type": "application/json" };
  const apiUrl = `${process.env.GOOGLE_SAFE_BROWSING_API}?key=${process.env.GOOGLE_SAFE_BROWSING_KEY}`;
  let submissionResponse = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await submissionResponse.json();
  console.log(`[LOOKUP OUTPUT] `, data)
  if (Object.keys(data).length <= 0) {
    return [false, null]
  }
  return [true, data.matches[0].threatType]
  
}

const toGoogleSafeBrowsing = async (url) => {
  const browser = await puppeteer.launch({ headless: true });
  console.log('visiting',process.env.GOOGLE_REPORT_URL )
  const page = await browser.newPage();
  await page.goto(process.env.GOOGLE_REPORT_URL);

  await page.click('#mat-select-0'); 
  await page.waitForSelector('mat-option');

  const options = await page.$$('mat-option');
  for (const option of options) {
    const text = await option.evaluate(el => el.textContent.trim());
    if (text === 'This page is not safe') {
      await option.click();
      break;
    }
  }

  const urlInput = "#mat-input-0"
  await page.waitForSelector(urlInput, { visible: true });
  await page.type(urlInput, url);

  await page.$eval('.form-submit-button', btn => btn.click());
  await browser.close();

  return true
}


const lookupPSafe = async (url) => {
  // ----- ALL POSSIBLE OUTPUTS -----
  outputs = {'NOT FOUND!': [false, null], 'CAUTION: SUSPECTED PHISHING SITE!': [true, 'Suspected Phishing']}
  // --------------------------------
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(process.env.PSAFE_LOOKUP_URL);

  const urlInput = "#url_query_shortcode"
  await page.waitForSelector(urlInput, { visible: true });
  await page.type(urlInput, url);

  const submitButton = "#submit-button"
  await page.waitForSelector(submitButton, { visible: true });
  await page.click(submitButton);
  await sleep(1500); // wait for overlay to appear

  const waitForActiveOverlay = async (page, timeout = 10000, interval = 500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const overlays = await page.$$('.reveal-overlay .reveal');
      for (const overlay of overlays) {
        const hasStyle = await overlay.evaluate(el => el.getAttribute('style') && el.getAttribute('style').trim() !== '');
        if (hasStyle) return overlay;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('No overlay with style attribute found within timeout');
  };

  const activeOverlay = await waitForActiveOverlay(page);
  const title = await activeOverlay.$eval('h1', el => el.innerText);
  const message = await activeOverlay.$eval('.pop-up-content', el => el.innerText);

  console.log(`[LOOKUP OUTPUT] `, data)

  await browser.close();
  return outputs[title]
}

const lookupNorton = async (url) => {
  // ----- ALL POSSIBLE OUTPUTS -----
  outputs = {'Warning': [true, 'warning'], 'Caution': [true, 'caution'], 'Untested': [false, null], 'Safe': [true, 'safe']}
  // --------------------------------
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(process.env.NORTON_LOOKUP_URL);

  const urlInput = 'input[formcontrolname="siteUrl"]'
  await page.waitForSelector(urlInput, { visible: true });
  await page.type(urlInput, url);
  await page.keyboard.press('Enter');
  await sleep(1000); // wait for result of search to complete

  const rating = await page.$eval('p.rating-label.xl-body-text-bold', el => el.textContent);
  console.log(rating);

  await sleep(1000);
  await browser.close();
  return outputs[rating]
}

// ----- END OF BLACKLIST FUNCTIONS -----


const process_url= async (url, blacklist) => {
      const response = await lookup(url, blacklist)
      console.log(`[LOOKUP RESULTS] `, response)
      if (response.url_exists) {
        console.log(`${response.url} exists in ${response.blacklist} with status: ${response.status}`)
      } else {
        console.log(`${response.url} does not exist in ${response.blacklist}`)
      }

      if (response.url_exists) {
        return
      } else {
        // check whether there is a submission to blacklist
        if (lookup_submit_dict[blacklist][1] != null) {
          const result_msg = await submit(url, blacklist)
          console.log(result_msg)
        }

        poll_lookup(url, blacklist) // will run asynchronously until on blacklist
      }
}

const submit = async (url, blacklist) => {
  console.log(`[SUBMIT] Submitting ${url} to ${blacklist}`);
  response = await lookup_submit_dict[blacklist][1](url)

  return {
    "url":url,
    "sent":new Date(Date.now()),
    "blacklist":blacklist,
    "submitted":response
  }
}

// returns [data_exists, status]
const lookup = async (url, blacklist) => {
  console.log(`[LOOKUP] Looking up ${url} in ${blacklist}`);
  response = await lookup_submit_dict[blacklist][0](url)

  return {
    "url":url,
    "time":new Date(Date.now()),
    "blacklist":blacklist,
    "url_exists":response[0],
    "status":response[1],
  }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll_lookup(url, blacklist, interval_min = 60, timeout_min = 360) {
  console.log(`[POLL] Polling ${url} in ${blacklist} `)
  const start = Date.now();
  interval_ms = interval_min * 60 * 1000
  timeout_ms = timeout_min * 60 * 1000
  try {
    while (true) {
      const lookup_response = await lookup(url, blacklist);
      const exists = lookup_response.url_exists;
      if (exists) {
        console.log(`${url} now exists in ${blacklist}`);
        break;
      }

      if (Date.now() - start >= timeout_ms) {
        console.warn(`[POLL TIMEOUT]: ${url} on ${blacklist}`);
        break;
      }
      
      await sleep(interval_ms);
    }
  } catch (err) {
    console.error(`Error polling ${blacklist} for ${url}:`, err);
  }
}

// lookups should return [true, _] or [false, null]
const lookup_submit_dict = {
  "alienVault": [lookupAlienVault, toAlienVault],
  "yandexSafeBrowsing": [lookupYandexSafeBrowsing, null],
  "googleSafeBrowsing": [lookupGoogleSafeBrowsing, toGoogleSafeBrowsing],
  "pSafe": [lookupPSafe, null],
  "norton": [lookupNorton, null],
}

module.exports = { 
  process_url
}