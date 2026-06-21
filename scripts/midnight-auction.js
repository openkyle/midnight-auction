const MODULE_ID = "midnight-auction";
const AUCTION_NAME = "Midnight Auction";
const SOCKET = `module.${MODULE_ID}`;
const STATE_SETTING = "state";
const CATALOG_SETTING = "catalog";
const TIMER_SETTING = "timerSeconds";
const DEFAULT_INCREMENT_SETTING = "defaultIncrement";
const SCENE_IMAGES_SETTING = "sceneImages";

function randomId() {
  return foundry.utils.randomID(16);
}

function defaultState() {
  return {
    status: "idle",
    roundId: null,
    itemId: null,
    currentPrice: 0,
    endsAt: null,
    winnerUserId: null,
    winnerActorUuid: null,
    bids: [],
    message: "The auction house is waiting for the next lot."
  };
}

function defaultCatalog() {
  return {
    rounds: [
      {
        id: randomId(),
        number: 1,
        title: "Round 1",
        items: [
          {
            id: randomId(),
            name: "Velvet-Wrapped Curiosity",
            img: "icons/commodities/treasure/trinket-wing-white.webp",
            description: "A mysterious first lot. Rename it, set a price, and start the bidding.",
            startingPrice: 10,
            increment: 5
          }
        ]
      }
    ]
  };
}

function getState() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, STATE_SETTING) ?? defaultState());
}

function getCatalog() {
  const catalog = foundry.utils.deepClone(game.settings.get(MODULE_ID, CATALOG_SETTING) ?? {});
  if (!Array.isArray(catalog.rounds) || !catalog.rounds.length) return defaultCatalog();
  return catalog;
}

async function setCatalog(catalog, { ping = true } = {}) {
  await game.settings.set(MODULE_ID, CATALOG_SETTING, catalog);
  renderAuctionApps();
  if (ping) game.socket.emit(SOCKET, { type: "catalog" });
}

async function setState(nextState, { ping = true } = {}) {
  const state = foundry.utils.mergeObject(defaultState(), nextState ?? {}, { inplace: false });
  await game.settings.set(MODULE_ID, STATE_SETTING, state);
  renderAuctionApps();
  if (ping) game.socket.emit(SOCKET, { type: "state" });
  return state;
}

function sceneImages() {
  const raw = game.settings.get(MODULE_ID, SCENE_IMAGES_SETTING) || "";
  const values = raw.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  return {
    idle: values[0] || "icons/environment/settlement/market-stall.webp",
    round: values[1] || values[0] || "icons/environment/settlement/market-stall.webp",
    item: values[2] || values[1] || values[0] || "icons/sundries/lights/candle-unlit-grey.webp",
    sold: values[3] || values[2] || values[0] || "icons/commodities/currency/coins-assorted-mix-gold.webp"
  };
}

function getCurrencyGp(actor) {
  return Number(foundry.utils.getProperty(actor, "system.currency.gp") ?? 0);
}

async function setCurrencyGp(actor, value) {
  return actor.update({ "system.currency.gp": Math.max(0, Number(value) || 0) });
}

function actorForUser(user) {
  return user.character ?? null;
}

function findRound(catalog, roundId) {
  return catalog.rounds.find((round) => round.id === roundId) ?? null;
}

function findLot(catalog, itemId) {
  for (const round of catalog.rounds) {
    const item = round.items.find((lot) => lot.id === itemId);
    if (item) return { round, item };
  }
  return { round: null, item: null };
}

function activeLot(catalog, state = getState()) {
  if (!state.itemId) return { round: null, item: null };
  return findLot(catalog, state.itemId);
}

function nextBidFor(item, state) {
  if (!item) return 0;
  const current = Number(state.currentPrice) || 0;
  const increment = Number(item.increment) || Number(game.settings.get(MODULE_ID, DEFAULT_INCREMENT_SETTING)) || 1;
  return state.bids?.length ? current + increment : Math.max(current, Number(item.startingPrice) || 0);
}

function bidRows(state) {
  return (state.bids ?? []).slice(0, 8);
}

function renderAuctionApps() {
  for (const app of Object.values(ui.windows)) {
    if (app instanceof MidnightAuctionApp) app.render(false);
  }
}

function isPrimaryActiveGM() {
  const activeGms = game.users.filter((user) => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id));
  return activeGms[0]?.id === game.user.id;
}

function notifyAll(message) {
  ui.notifications.info(message);
  game.socket.emit(SOCKET, { type: "notify", message });
}

async function postBidChat(bidderName, amount, itemName) {
  const content = `<p><strong>${bidderName}</strong> bids <strong>${amount} gp</strong> on <em>${itemName}</em>.</p>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: AUCTION_NAME }),
    content
  });
}

async function ensureMacros() {
  if (!game.user.isGM) return;
  const macroData = [
    {
      name: "Midnight Auction",
      img: "icons/commodities/currency/coins-assorted-mix-gold.webp",
      command: `game.modules.get("${MODULE_ID}").api.open();`
    },
    {
      name: "Open Midnight Auction",
      img: "icons/commodities/currency/coins-plain-stack-gold.webp",
      command: `game.modules.get("${MODULE_ID}").api.open();`
    }
  ];

  for (const data of macroData) {
    const existing = game.macros.find((macro) => macro.name === data.name);
    if (existing) continue;
    await Macro.create({
      ...data,
      type: "script",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
    });
  }
}

function addFloatingButton() {
  if (document.getElementById("midnight-auction-float")) return;

  const button = document.createElement("button");
  button.id = "midnight-auction-float";
  button.type = "button";
  button.innerHTML = `<i class="fas fa-gavel"></i><span>Midnight Auction</span>`;
  button.title = game.user.isGM ? "Open Midnight Auction builder" : "Open Midnight Auction";
  button.addEventListener("click", () => openAuction());
  document.body.appendChild(button);
}

class MidnightAuctionApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "midnight-auction",
      classes: ["midnight-auction-window"],
      title: AUCTION_NAME,
      template: `modules/${MODULE_ID}/templates/auction-app.hbs`,
      width: 900,
      height: "auto",
      resizable: true
    });
  }

  constructor(options = {}) {
    super(options);
    this._clock = null;
    this._ending = false;
  }

  async getData() {
    const catalog = getCatalog();
    const state = getState();
    const { round, item: activeItem } = activeLot(catalog, state);
    const item = activeItem ?? {
      id: null,
      name: "No lot is live",
      img: "icons/svg/item-bag.svg",
      description: "The GM has not started a lot yet."
    };
    const images = sceneImages();
    const now = Date.now();
    const timeLeft = state.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
    const goldActor = actorForUser(game.user);
    const gold = goldActor ? getCurrencyGp(goldActor) : 0;
    const nextBid = nextBidFor(activeItem, state);

    return {
      isGM: game.user.isGM,
      title: state.status === "item" ? "Bidding Is Live" : AUCTION_NAME,
      subtitle: state.message,
      sceneImage: activeItem?.sceneImg || images[state.status] || images.idle,
      timerLabel: state.status === "item" ? "Seconds Left" : "Timer",
      timeLeft: state.status === "item" ? timeLeft : "--",
      urgent: state.status === "item" && timeLeft <= 3,
      item,
      itemDescription: activeItem ? await TextEditor.enrichHTML(activeItem.description || "", { async: true }) : "<p>The velvet curtain has not lifted yet.</p>",
      currentPrice: Number(state.currentPrice) || 0,
      nextBid,
      gold,
      canBid: Boolean(activeItem && state.status === "item" && goldActor && gold >= nextBid),
      bids: bidRows(state),
      rounds: catalog.rounds.map((catalogRound) => ({
        ...catalogRound,
        active: state.roundId === catalogRound.id,
        items: catalogRound.items.map((lot) => ({
          ...lot,
          active: state.itemId === lot.id,
          increment: Number(lot.increment) || Number(game.settings.get(MODULE_ID, DEFAULT_INCREMENT_SETTING)) || 1
        }))
      })),
      activeRoundTitle: round?.title || ""
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='refresh']").on("click", () => this.render(false));
    html.find("[data-action='stop-auction']").on("click", () => this._onStopAuction());
    html.find("[data-action='add-round']").on("click", () => this._onAddRound());
    html.find("[data-action='delete-round']").on("click", (event) => this._onDeleteRound(event));
    html.find("[data-action='add-item']").on("click", (event) => this._onAddItem(event));
    html.find("[data-action='delete-item']").on("click", (event) => this._onDeleteItem(event));
    html.find("[data-action='start-round']").on("click", (event) => this._onStartRound(event));
    html.find("[data-action='end-round']").on("click", (event) => this._onEndRound(event));
    html.find("[data-action='start-item']").on("click", (event) => this._onStartItem(event));
    html.find("[data-action='end-item']").on("click", (event) => this._onEndItem(event));
    html.find("[data-action='bid']").on("click", () => this._onBid());
    html.find("[data-field]").on("change", (event) => this._onFieldChange(event));
  }

  async _render(...args) {
    await super._render(...args);
    this._startClock();
  }

  close(options) {
    if (this._clock) window.clearInterval(this._clock);
    this._clock = null;
    return super.close(options);
  }

  _startClock() {
    if (this._clock) window.clearInterval(this._clock);
    this._clock = window.setInterval(() => {
      const state = getState();
      if (state.status === "item" && state.endsAt && Date.now() >= state.endsAt && game.user.isGM && isPrimaryActiveGM() && !this._ending) {
        this._onEndItem({ currentTarget: { dataset: { itemId: state.itemId } } });
      } else {
        this.render(false);
      }
    }, 1000);
  }

  async _onStopAuction() {
    if (!game.user.isGM) return;
    await setState({ ...defaultState(), message: "The Midnight Auction closes its doors." });
    notifyAll("The Midnight Auction has ended.");
  }

  async _onAddRound() {
    if (!game.user.isGM) return;
    const catalog = getCatalog();
    const nextNumber = Math.max(0, ...catalog.rounds.map((round) => Number(round.number) || 0)) + 1;
    catalog.rounds.push({
      id: randomId(),
      number: nextNumber,
      title: `Round ${nextNumber}`,
      items: []
    });
    await setCatalog(catalog);
  }

  async _onDeleteRound(event) {
    if (!game.user.isGM) return;
    const roundId = event.currentTarget.dataset.roundId;
    const catalog = getCatalog();
    catalog.rounds = catalog.rounds.filter((round) => round.id !== roundId);
    if (!catalog.rounds.length) catalog.rounds = defaultCatalog().rounds;

    const state = getState();
    if (state.roundId === roundId) await setState(defaultState(), { ping: false });
    await setCatalog(catalog);
  }

  async _onAddItem(event) {
    if (!game.user.isGM) return;
    const roundId = event.currentTarget.dataset.roundId;
    const catalog = getCatalog();
    const round = findRound(catalog, roundId);
    if (!round) return;

    round.items.push({
      id: randomId(),
      name: "New Auction Lot",
      img: "icons/svg/item-bag.svg",
      sceneImg: "",
      description: "Describe this lot for your bidders.",
      startingPrice: 10,
      increment: Number(game.settings.get(MODULE_ID, DEFAULT_INCREMENT_SETTING)) || 10
    });
    await setCatalog(catalog);
  }

  async _onDeleteItem(event) {
    if (!game.user.isGM) return;
    const itemId = event.currentTarget.dataset.itemId;
    const catalog = getCatalog();
    for (const round of catalog.rounds) {
      round.items = round.items.filter((item) => item.id !== itemId);
    }

    const state = getState();
    if (state.itemId === itemId) await setState(defaultState(), { ping: false });
    await setCatalog(catalog);
  }

  async _onStartRound(event) {
    if (!game.user.isGM) return;
    const catalog = getCatalog();
    const round = findRound(catalog, event.currentTarget.dataset.roundId);
    if (!round) return;

    await setState({
      ...getState(),
      status: "round",
      roundId: round.id,
      itemId: null,
      currentPrice: 0,
      endsAt: null,
      winnerUserId: null,
      winnerActorUuid: null,
      bids: [],
      message: `${round.title || `Round ${round.number}`} is now live. The next lot is coming up.`
    });
    notifyAll(`${round.title || `Round ${round.number}`} of the Midnight Auction is live.`);
  }

  async _onEndRound(event) {
    if (!game.user.isGM) return;
    const catalog = getCatalog();
    const round = findRound(catalog, event.currentTarget.dataset.roundId);
    if (!round) return;

    await setState({
      ...getState(),
      status: "idle",
      roundId: round.id,
      itemId: null,
      currentPrice: 0,
      endsAt: null,
      bids: [],
      message: `${round.title || `Round ${round.number}`} has ended.`
    });
    notifyAll(`${round.title || `Round ${round.number}`} has ended.`);
  }

  async _onStartItem(event) {
    if (!game.user.isGM) return;
    const catalog = getCatalog();
    const { round, item } = findLot(catalog, event.currentTarget.dataset.itemId);
    if (!round || !item) return;

    const startingPrice = Number(item.startingPrice) || 0;
    const timerSeconds = Number(game.settings.get(MODULE_ID, TIMER_SETTING)) || 10;
    await setState({
      status: "item",
      roundId: round.id,
      itemId: item.id,
      currentPrice: startingPrice,
      endsAt: Date.now() + timerSeconds * 1000,
      winnerUserId: null,
      winnerActorUuid: null,
      bids: [],
      message: `${item.name} is on the block. Opening bid: ${startingPrice} gp.`
    });
    notifyAll(`${item.name} is live at the Midnight Auction.`);
  }

  async _onEndItem(event) {
    if (!game.user.isGM || !isPrimaryActiveGM()) return;
    this._ending = true;
    try {
      const catalog = getCatalog();
      const state = getState();
      const itemId = event.currentTarget.dataset.itemId || state.itemId;
      const { item } = findLot(catalog, itemId);
      if (!item || state.itemId !== itemId) return;

      const winningBid = state.bids?.[0];
      if (winningBid) await this._settleWinningBid(winningBid);

      const message = winningBid
        ? `${winningBid.bidderName} wins ${item.name} for ${winningBid.amount} gp.`
        : `${item.name} received no bids.`;
      await setState({
        ...state,
        status: "sold",
        endsAt: null,
        message
      });
      notifyAll(message);
    } finally {
      this._ending = false;
    }
  }

  async _settleWinningBid(winningBid) {
    const winnerActor = await fromUuid(winningBid.actorUuid);
    if (!winnerActor) return;
    const gold = getCurrencyGp(winnerActor);
    await setCurrencyGp(winnerActor, gold - winningBid.amount);
  }

  async _onBid() {
    const actor = actorForUser(game.user);
    if (!actor) return ui.notifications.warn("Assign your player character before bidding.");
    game.socket.emit(SOCKET, {
      type: "bid",
      userId: game.user.id,
      actorUuid: actor.uuid
    });
  }

  async _onFieldChange(event) {
    if (!game.user.isGM) return;
    const field = event.currentTarget.dataset.field;
    const roundId = event.currentTarget.dataset.roundId;
    const itemId = event.currentTarget.dataset.itemId;
    const catalog = getCatalog();

    if (roundId && !itemId) {
      const round = findRound(catalog, roundId);
      if (!round) return;
      if (field === "number") round.number = Math.max(1, Number(event.currentTarget.value) || 1);
      if (field === "title") round.title = event.currentTarget.value.trim() || `Round ${round.number || 1}`;
    }

    if (itemId) {
      const { item } = findLot(catalog, itemId);
      if (!item) return;
      if (["startingPrice", "increment"].includes(field)) item[field] = Math.max(field === "increment" ? 1 : 0, Number(event.currentTarget.value) || 0);
      if (["name", "img", "sceneImg", "description"].includes(field)) item[field] = event.currentTarget.value;
    }

    catalog.rounds.sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
    await setCatalog(catalog);
  }
}

async function processBid(data) {
  if (!game.user.isGM || !isPrimaryActiveGM()) return;
  const bidder = game.users.get(data.userId);
  const bidderActor = await fromUuid(data.actorUuid);
  const catalog = getCatalog();
  const state = getState();
  const { item } = activeLot(catalog, state);
  if (!bidder || !bidderActor || !item || state.status !== "item") return;

  const amount = nextBidFor(item, state);
  if (getCurrencyGp(bidderActor) < amount) {
    game.socket.emit(SOCKET, { type: "notify", userId: data.userId, message: `Not enough gold to bid ${amount} gp.` });
    return;
  }

  const timerSeconds = Number(game.settings.get(MODULE_ID, TIMER_SETTING)) || 10;
  const bid = {
    bidderName: bidder.name,
    userId: bidder.id,
    actorUuid: bidderActor.uuid,
    amount,
    time: Date.now()
  };

  const nextState = {
    ...state,
    currentPrice: amount,
    endsAt: Date.now() + timerSeconds * 1000,
    winnerUserId: bidder.id,
    winnerActorUuid: bidderActor.uuid,
    bids: [bid, ...(state.bids ?? [])].slice(0, 20),
    message: `${bidder.name} bids ${amount} gp. Going once...`
  };
  await setState(nextState);
  await postBidChat(bidder.name, amount, item.name);
  notifyAll(`${bidder.name} bids ${amount} gp on ${item.name}.`);
}

function openAuction() {
  const existing = Object.values(ui.windows).find((app) => app instanceof MidnightAuctionApp);
  if (existing) return existing.render(true);
  return new MidnightAuctionApp().render(true);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STATE_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: defaultState()
  });

  game.settings.register(MODULE_ID, CATALOG_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: defaultCatalog()
  });

  game.settings.register(MODULE_ID, TIMER_SETTING, {
    name: "Bid Timer Seconds",
    hint: "The countdown length. Each accepted bid resets the timer to this value.",
    scope: "world",
    config: true,
    type: Number,
    default: 10
  });

  game.settings.register(MODULE_ID, DEFAULT_INCREMENT_SETTING, {
    name: "Default Bid Increment",
    hint: "Default gold increase for new lots.",
    scope: "world",
    config: true,
    type: Number,
    default: 10
  });

  game.settings.register(MODULE_ID, SCENE_IMAGES_SETTING, {
    name: "Scene Images",
    hint: "Optional image paths, one per line: idle, round live, item live, sold.",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });
});

Hooks.once("ready", async () => {
  game.socket.on(SOCKET, async (data) => {
    if (data.type === "bid") return processBid(data);
    if (data.type === "state" || data.type === "catalog") return renderAuctionApps();
    if (data.type === "notify") {
      if (!data.userId || data.userId === game.user.id) ui.notifications.info(data.message);
      return renderAuctionApps();
    }
    return null;
  });

  addFloatingButton();
  await ensureMacros();
});

Hooks.on("renderSceneControls", () => addFloatingButton());
Hooks.on("canvasReady", () => addFloatingButton());

game.modules.get(MODULE_ID).api = {
  open: openAuction,
  reset: () => setState(defaultState()),
  getCatalog,
  setCatalog
};
