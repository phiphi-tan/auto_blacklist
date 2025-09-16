require('dotenv').config();

const url_list = [
    "https://smbc.stoeckli.cn/v1/check", // true malicious URL
    // "www.google.com", // true benign URL
    // "http://malicious-url.com", // random URL, should not exist in databases
]
// blacklists to test
const blacklist_list = [
  "alienVault", 
  // "yandexSafeBrowsing",
  // "googleSafeBrowsing",
  // "pSafe",
  // "norton",
]

const {process_url} = require('./auto_blacklist.js');

(async () => {
  try {

    for (url of url_list) {
      for (blacklist of blacklist_list) {
        await process_url(url, blacklist)
      }
    }

  } catch (err) {
    console.error("Error:", err);
  }
})();
