import { NS, ScriptArg } from '@ns';

const doc = eval('document');
let ns: NS;

const verbose = false;
const options = {
  'find-sleep-time': 10,
  'click-sleep-time': 10,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (ns: NS, ...args: any[]) => ns.print(...args);

async function click(button) {
  if (button === null || button === undefined)
    throw new Error(
      'click was called on a null reference. This means the prior button detection failed, but was assumed to have succeeded.',
    );
  // Sleep before clicking, if so configured
  const sleepDelay = options['click-sleep-time'];
  if (sleepDelay > 0) await ns.sleep(sleepDelay);
  // Find the onclick method on the button
  const fnOnClick = button[Object.keys(button)[1]].onClick; // This is voodoo to me. Apparently it's function on the first property of this button?
  if (!fnOnClick)
    throw new Error(
      `Odd, we found the button we were looking for (${button.text()}), but couldn't find its onclick method!`,
    );
  if (verbose) log(ns, `Clicking the button.`);
  // Click the button. The "secret" to this working is just to pass any object containing isTrusted:true
  await fnOnClick({ isTrusted: true });
  // Sleep after clicking, if so configured
  if (sleepDelay > 0) await ns.sleep(sleepDelay);
}

async function internalfindWithRetry(
  xpath: string,
  expectFailure: boolean,
  maxRetries: number,
  customErrorMessage = null,
) {
  try {
    // NOTE: We cannot actually log the xpath we're searching for because depending on the xpath, it might match our log!
    // So here's a trick to convert the characters into "look-alikes"
    const logSafeXPath = xpath.substring(2, 20) + '...'; // TODO: Some trick to convert the characters into "look-alikes" (ạḅc̣ḍ...)
    if (verbose)
      log(
        ns,
        `INFO: ${expectFailure ? 'Checking if element is on screen' : 'Searching for expected element'
        }: "${logSafeXPath}"`,
        false,
      );
    // If enabled give the game some time to render an item before we try to find it on screen
    if (options['find-sleep-time']) await ns.sleep(options['find-sleep-time']);
    let attempts = 0,
      retryDelayMs = 1; // starting retry delay (ms), will be increased with each attempt
    while (attempts++ <= maxRetries) {
      // Sleep between attempts
      if (attempts > 1) {
        if (verbose || !expectFailure)
          log(
            ns,
            (expectFailure ? 'INFO' : 'WARN') +
            `: Attempt ${attempts - 1} of ${maxRetries} to find \"${logSafeXPath}\" failed. Retrying...`,
            false,
          );
        await ns.sleep(retryDelayMs);
        retryDelayMs *= 2; // back-off rate (increases next sleep time before retrying)
        retryDelayMs = Math.min(retryDelayMs, 200); // Cap the retry rate at 200 ms (game tick rate)
      }
      const findAttempt = internalFind(xpath);
      if (findAttempt !== null) return findAttempt;
    }
    if (expectFailure) {
      if (verbose) log(ns, `INFO: Element doesn't appear to be present, moving on...`, false);
    } else {
      const errMessage =
        customErrorMessage ??
        `Could not find the element with xpath: \"${logSafeXPath}\"\n` +
        `Something may have stolen focus or otherwise routed the UI away from the Casino.`;
      log(ns, 'ERROR: ' + errMessage, true, 'error');
      throw errMessage;
    }
  } catch (e) {
    if (!expectFailure) throw e;
  }
  return null;
}

function internalFind(xpath: string) {
  return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

async function tryfindElement(xpath: string, retries = 4) {
  return await internalfindWithRetry(xpath, true, retries);
}

async function checkKickedOut(retries = 10) {
  let closeModal;

  do {
    const kickedOut = await tryfindElement("//span[contains(text(), 'Alright cheater get out of here')]", retries);
    if (kickedOut !== null) return true;
    const closeModal = await tryfindElement("//button[contains(@class,'closeButton')]", retries);
    if (!closeModal) break;
    log(ns, 'Found a modal that needs to be closed.');
    await click(closeModal);
  } while (closeModal !== null);
  return false;
}

export async function main(nsContext: NS): Promise<void> {
  ns = nsContext;
  // Main
  const period = 1024;
  const values: ('H' | 'T')[] = [];

  for (let i = 0; i < period; ++i) {
    ns.singularity.casi;
  }
}
