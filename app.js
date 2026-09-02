(function () {
  "use strict";

  var STORAGE_KEY = "zhar-menu-data";
  var ORDERS_STORAGE_KEY = "zhar-orders-data";
  var QUEUE_STORAGE_KEY = "zhar-queue-data";
  var WAITING_STORAGE_KEY = "zhar-waiting-data";
  var ORDER_COUNTER_KEY = "zhar-order-counter";
  var DEBTS_STORAGE_KEY = "zhar-debts-data";
  var EMOJI_OPTIONS = ["🍔", "🍟", "🥤", "🍗", "🌭", "🥗", "🍰", "🌶️", "🧀", "🥓"];
  var MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  var SEED_CATEGORIES = [
    { id: "c1", name: "Бургеры", icon: "🍔" },
    { id: "c2", name: "Закуски", icon: "🍟" },
    { id: "c3", name: "Напитки", icon: "🥤" }
  ];
  var SEED_PRODUCTS = [
    { id: "p1", categoryId: "c1", name: "Классический", price: 350 },
    { id: "p2", categoryId: "c1", name: "Двойной сыр", price: 420 },
    { id: "p3", categoryId: "c1", name: "Острый техас", price: 400 },
    { id: "p4", categoryId: "c2", name: "Картофель фри", price: 180 },
    { id: "p5", categoryId: "c2", name: "Луковые кольца", price: 190 },
    { id: "p6", categoryId: "c3", name: "Кола 0.5", price: 120 },
    { id: "p7", categoryId: "c3", name: "Лимонад домашний", price: 150 }
  ];

  var state = {
    categories: [],
    products: [],
    activeCategory: null,
    mode: "menu",
    cart: {},
    prepTime: 15,
    addingCategory: false,
    newCatName: "",
    newCatIcon: "🍔",
    addingProductFor: null,
    companyName: "Жар",
    orders: [],
    queue: [],
    waitingPayment: [],
    orderCounter: 1,
    debts: [],
    debtForm: null,
    payForm: null,
    viewingDebtId: null,
    copiedOrderId: null,
    expandedQueueId: null,
    report: { section: "orders", month: currentMonthKey(), day: todayKey() }
  };

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function categoryIcon(categoryId) {
    var cat = state.categories.filter(function (c) { return c.id === categoryId; })[0];
    return (cat && cat.icon) || "🍽️";
  }
  function iconForItem(item) {
    if (item.icon) return item.icon;
    var product = state.products.filter(function (p) { return p.name === item.name; })[0];
    return product ? categoryIcon(product.categoryId) : "🍽️";
  }
  function currentMonthKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  function monthLabel(monthKey) {
    var parts = monthKey.split("-");
    return MONTH_NAMES[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }
  function daysInMonth(monthKey) {
    var parts = monthKey.split("-");
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
  }
  function monthOptions() {
    var out = [];
    var now = new Date();
    for (var i = 0; i < 12; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1));
    }
    return out;
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.categories = parsed.categories || SEED_CATEGORIES;
        state.products = parsed.products || SEED_PRODUCTS;
        state.companyName = parsed.companyName || "Жар";
      } else {
        state.categories = SEED_CATEGORIES;
        state.products = SEED_PRODUCTS;
      }
    } catch (e) {
      state.categories = SEED_CATEGORIES;
      state.products = SEED_PRODUCTS;
    }
    if (state.categories.length) state.activeCategory = state.categories[0].id;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories: state.categories, products: state.products, companyName: state.companyName }));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function updateCompanyName(value) {
    state.companyName = value;
    saveData();
  }

  function seedOrders() {
    var out = [];
    var now = new Date();
    var offsets = [0, 0, 1, 2, 3, 4, 6, 8];
    var times = ["09:15", "12:40", "11:05", "13:20", "14:00", "16:30", "10:10", "18:45"];
    var num = 1;
    offsets.forEach(function (offset, idx) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      if (d.getMonth() !== now.getMonth()) return;
      var itemsCount = 1 + (idx % 3);
      var items = [];
      for (var i = 0; i < itemsCount; i++) {
        var p = SEED_PRODUCTS[(idx + i) % SEED_PRODUCTS.length];
        var qty = 1 + ((idx + i) % 2);
        items.push({ name: p.name, price: p.price, qty: qty });
      }
      var total = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
      out.push({
        id: "o" + (Date.now() + idx),
        number: num++,
        date: d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()),
        time: times[idx % times.length],
        items: items,
        total: total
      });
    });
    return out;
  }

  function loadOrders() {
    try {
      var raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        state.orders = JSON.parse(raw) || [];
      } else {
        state.orders = seedOrders();
        saveOrders();
      }
    } catch (e) {
      state.orders = seedOrders();
    }
  }

  function saveOrders() {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(state.orders));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function loadQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      state.queue = raw ? JSON.parse(raw) || [] : [];
    } catch (e) {
      state.queue = [];
    }
  }

  function saveQueue() {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state.queue));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function loadWaitingPayment() {
    try {
      var raw = localStorage.getItem(WAITING_STORAGE_KEY);
      state.waitingPayment = raw ? JSON.parse(raw) || [] : [];
    } catch (e) {
      state.waitingPayment = [];
    }
  }

  function saveWaitingPayment() {
    try {
      localStorage.setItem(WAITING_STORAGE_KEY, JSON.stringify(state.waitingPayment));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function moveOrderToWaiting(id) {
    var order = state.queue.filter(function (o) { return o.id === id; })[0];
    if (!order) return;
    state.queue = state.queue.filter(function (o) { return o.id !== id; });
    state.waitingPayment.push(order);
    saveQueue();
    saveWaitingPayment();
  }

  function findActiveOrder(id) {
    var o = state.queue.filter(function (x) { return x.id === id; })[0];
    if (o) return o;
    return state.waitingPayment.filter(function (x) { return x.id === id; })[0];
  }

  function removeFromActiveLists(id) {
    state.queue = state.queue.filter(function (o) { return o.id !== id; });
    state.waitingPayment = state.waitingPayment.filter(function (o) { return o.id !== id; });
    saveQueue();
    saveWaitingPayment();
  }

  function loadDebts() {
    try {
      var raw = localStorage.getItem(DEBTS_STORAGE_KEY);
      state.debts = raw ? JSON.parse(raw) || [] : [];
    } catch (e) {
      state.debts = [];
    }
  }

  function saveDebts() {
    try {
      localStorage.setItem(DEBTS_STORAGE_KEY, JSON.stringify(state.debts));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function openDebtForm(orderId) {
    var order = findActiveOrder(orderId);
    if (!order) return;
    state.debtForm = {
      orderId: order.id,
      orderNumber: order.number,
      items: order.items,
      phone: "",
      name: "",
      address: "",
      amount: order.total,
      dueDate: "",
      returnMode: state.mode
    };
    state.mode = "debt-form";
    render();
  }

  function cancelDebtForm() {
    var returnMode = (state.debtForm && state.debtForm.returnMode) || "queue";
    state.debtForm = null;
    state.mode = returnMode;
    render();
  }

  function saveDebt() {
    var f = state.debtForm;
    if (!f) return;
    var nameInput = document.getElementById("debt-name");
    var phoneInput = document.getElementById("debt-phone");
    var addressInput = document.getElementById("debt-address");
    var amountInput = document.getElementById("debt-amount");
    var dueInput = document.getElementById("debt-due");
    var name = nameInput ? nameInput.value.trim() : "";
    if (!name) return;
    state.debts.push({
      id: "d" + Date.now(),
      orderId: f.orderId,
      orderNumber: f.orderNumber,
      items: f.items,
      name: name,
      phone: phoneInput ? phoneInput.value.trim() : "",
      address: addressInput ? addressInput.value.trim() : "",
      amount: amountInput ? (parseInt(amountInput.value, 10) || 0) : f.amount,
      paidAmount: 0,
      status: "open",
      dueDate: dueInput ? dueInput.value : "",
      createdDate: todayKey(),
      paidDate: null
    });
    saveDebts();
    removeFromActiveLists(f.orderId);
    var returnMode = f.returnMode || "queue";
    state.debtForm = null;
    state.mode = returnMode;
    render();
  }

  function openPayForm(debtId) {
    var debt = state.debts.filter(function (d) { return d.id === debtId; })[0];
    if (!debt) return;
    var remaining = debt.amount - (debt.paidAmount || 0);
    state.payForm = { debtId: debtId, amount: remaining, returnMode: state.mode };
    state.mode = "pay-debt-form";
    render();
  }

  function cancelPayForm() {
    var returnMode = (state.payForm && state.payForm.returnMode) || "report";
    state.payForm = null;
    state.mode = returnMode;
    render();
  }

  function savePayment() {
    var f = state.payForm;
    if (!f) return;
    var debt = state.debts.filter(function (d) { return d.id === f.debtId; })[0];
    if (!debt) return;
    var amountInput = document.getElementById("pay-amount");
    var amt = amountInput ? (parseInt(amountInput.value, 10) || 0) : 0;
    if (amt <= 0) return;
    debt.paidAmount = Math.min(debt.amount, (debt.paidAmount || 0) + amt);
    if (debt.paidAmount >= debt.amount) {
      debt.status = "paid";
      debt.paidDate = todayKey();
    }
    saveDebts();
    var returnMode = f.returnMode || "report";
    state.payForm = null;
    state.mode = returnMode;
    render();
  }

  function loadOrderCounter() {
    try {
      var raw = localStorage.getItem(ORDER_COUNTER_KEY);
      if (raw) {
        state.orderCounter = parseInt(raw, 10) || 1;
      } else {
        var maxNum = state.orders.reduce(function (max, o) { return Math.max(max, o.number); }, 0);
        state.orderCounter = maxNum + 1;
      }
    } catch (e) {
      state.orderCounter = 1;
    }
  }

  function saveOrderCounter() {
    try {
      localStorage.setItem(ORDER_COUNTER_KEY, String(state.orderCounter));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function changeOrderCounter(delta) {
    state.orderCounter = Math.max(1, state.orderCounter + delta);
    saveOrderCounter();
    render();
  }

  function ordersForMonth(monthKey) {
    return state.orders.filter(function (o) { return o.date.indexOf(monthKey) === 0; });
  }
  function ordersForDay(dayKey) {
    return state.orders.filter(function (o) { return o.date === dayKey; })
      .sort(function (a, b) { return a.time < b.time ? 1 : -1; });
  }
  function sumTotals(list) {
    return list.reduce(function (s, o) { return s + o.total; }, 0);
  }

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function iconSvg(name, size, extra) {
    size = size || 16;
    var strokeW = 2;
    var common = 'width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + strokeW + '" stroke-linecap="round" stroke-linejoin="round" class="icon"' + (extra || "");
    var paths = {
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
      flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2 1z"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      report: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/>',
      queue: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
      debt: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01"/><path d="M18 12h.01"/>'
    };
    return '<svg ' + common + '>' + (paths[name] || "") + '</svg>';
  }

  function cartEntries() {
    var out = [];
    Object.keys(state.cart).forEach(function (id) {
      var qty = state.cart[id];
      var product = state.products.filter(function (p) { return p.id === id; })[0];
      if (product && qty > 0) out.push({ product: product, qty: qty });
    });
    return out;
  }

  function orderTotal() {
    return cartEntries().reduce(function (sum, e) { return sum + e.product.price * e.qty; }, 0);
  }

  function increment(id) {
    state.cart[id] = (state.cart[id] || 0) + 1;
    render();
  }
  function decrement(id) {
    var qty = (state.cart[id] || 0) - 1;
    if (qty <= 0) delete state.cart[id];
    else state.cart[id] = qty;
    render();
  }
  function changePrepTime(delta) {
    state.prepTime = Math.max(5, state.prepTime + delta);
    render();
  }

  function addToQueue() {
    var entries = cartEntries();
    if (entries.length === 0) return;
    var now = new Date();
    var order = {
      id: "o" + Date.now(),
      number: state.orderCounter,
      date: now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()),
      time: pad2(now.getHours()) + ":" + pad2(now.getMinutes()),
      items: entries.map(function (e) { return { name: e.product.name, price: e.product.price, qty: e.qty, icon: categoryIcon(e.product.categoryId) }; }),
      total: orderTotal(),
      prepTime: state.prepTime
    };
    state.orders.push(order);
    saveOrders();
    state.queue.push(order);
    saveQueue();
    state.orderCounter += 1;
    saveOrderCounter();
    state.cart = {};
    state.mode = "queue";
    render();
  }

  function completeQueueOrder(id) {
    removeFromActiveLists(id);
    render();
  }

  function copyOrderText(id) {
    var order = state.queue.filter(function (o) { return o.id === id; })[0];
    if (!order) return;
    var divider = "▫️▫️▫️▫️▫️▫️▫️▫️▫️";
    var lines = order.items.map(function (it) {
      return iconForItem(it) + " " + it.name + " x" + it.qty + " — " + (it.price * it.qty) + " \u20BD";
    });
    var text = [
      "🔥 Заказ №" + order.number,
      divider
    ].concat(lines).concat([
      divider,
      "💰 Итого: " + order.total + " \u20BD",
      "⏱️ Время приготовления: " + order.prepTime + " мин",
      "",
      "Спасибо за заказ! 🙏"
    ]).join("\n");
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { console.error(e); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
    state.copiedOrderId = id;
    render();
    setTimeout(function () {
      if (state.copiedOrderId === id) {
        state.copiedOrderId = null;
        render();
      }
    }, 1800);
  }

  function addCategory() {
    var name = state.newCatName.trim();
    if (!name) return;
    var id = "c" + Date.now();
    state.categories.push({ id: id, name: name, icon: state.newCatIcon });
    state.newCatName = "";
    state.newCatIcon = "🍔";
    state.addingCategory = false;
    saveData();
    render();
  }

  function deleteCategory(id) {
    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    state.products = state.products.filter(function (p) { return p.categoryId !== id; });
    if (state.activeCategory === id) {
      state.activeCategory = state.categories.length ? state.categories[0].id : null;
    }
    saveData();
    render();
  }

  function addProduct(catId) {
    var nameInput = document.getElementById("new-prod-name");
    var priceInput = document.getElementById("new-prod-price");
    var name = nameInput ? nameInput.value.trim() : "";
    var price = priceInput ? parseInt(priceInput.value, 10) : 0;
    if (!name || !price || price <= 0) return;
    var id = "p" + Date.now();
    state.products.push({ id: id, categoryId: catId, name: name, price: price });
    state.addingProductFor = null;
    saveData();
    render();
  }

  function deleteProduct(id) {
    state.products = state.products.filter(function (p) { return p.id !== id; });
    saveData();
    render();
  }

  function updateProductLive(id, field, value) {
    var p = state.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    p[field] = field === "price" ? (parseInt(value, 10) || 0) : value;
    saveData();
  }

  var MODE_TITLES = {
    admin: "Управление меню",
    notifications: "Уведомления",
    report: "Отчёт",
    queue: "Очередь заказов",
    "debt-form": "Оформление долга",
    "pay-debt-form": "Оплата долга",
    "debt-detail": "Данные о клиенте"
  };

  function renderHeader() {
    if (state.mode === "menu") {
      return (
        '<div class="header">' +
          '<div>' +
            '<div class="brand">' + iconSvg("flame", 22) + '<h1>' + esc(state.companyName) + '</h1></div>' +
            '<p class="tagline">бургеры на углях</p>' +
          '</div>' +
          '<div class="header-actions">' +
            '<button class="icon-btn" data-action="open-notifications" aria-label="Уведомления">' + iconSvg("bell", 18) + '</button>' +
            '<button class="icon-btn" data-action="open-report" aria-label="Отчёт">' + iconSvg("report", 18) + '</button>' +
            '<button class="icon-btn" data-action="open-queue" aria-label="Очередь заказов">' + iconSvg("queue", 18) + '</button>' +
            '<button class="icon-btn" data-action="open-admin" aria-label="Управление меню">' + iconSvg("settings", 18) + '</button>' +
          '</div>' +
        '</div>'
      );
    }
    var backAction = state.mode === "debt-form" ? "cancel-debt" : (state.mode === "pay-debt-form" ? "cancel-pay" : (state.mode === "debt-detail" ? "back-to-report" : "open-menu"));
    return (
      '<div class="header">' +
        '<button class="back-btn" data-action="' + backAction + '">' + iconSvg("back", 18) + ' Назад</button>' +
        '<h1 class="admin-title">' + (MODE_TITLES[state.mode] || "") + '</h1>' +
        '<div style="width:40px"></div>' +
      '</div>'
    );
  }

  function renderMenu() {
    var pills = state.categories.map(function (c) {
      var active = c.id === state.activeCategory;
      return '<button class="pill' + (active ? " active" : "") + '" data-action="select-cat" data-id="' + c.id + '">' +
        '<span class="icon">' + c.icon + '</span>' + esc(c.name) + '</button>';
    }).join("");

    var visible = state.products.filter(function (p) { return p.categoryId === state.activeCategory; });
    var productsHtml = visible.length === 0
      ? '<p class="empty">В этой категории пока нет товаров.</p>'
      : visible.map(function (p) {
          var qty = state.cart[p.id] || 0;
          return (
            '<div class="product-card">' +
              '<div class="product-info"><span class="product-name">' + esc(p.name) + '</span><span class="product-price">' + p.price + ' \u20BD</span></div>' +
              '<div class="stepper">' +
                (qty > 0 ? '<button class="step-btn" data-action="dec" data-id="' + p.id + '" aria-label="Убрать">' + iconSvg("minus", 15) + '</button>' : '') +
                (qty > 0 ? '<span class="qty">' + qty + '</span>' : '') +
                '<button class="step-btn plus" data-action="inc" data-id="' + p.id + '" aria-label="Добавить">' + iconSvg("plus", 15) + '</button>' +
              '</div>' +
            '</div>'
          );
        }).join("");

    var entries = cartEntries();
    var summaryHtml = "";
    if (entries.length > 0) {
      var lines = entries.map(function (e) {
        return '<div class="order-line"><span>' + categoryIcon(e.product.categoryId) + ' ' + esc(e.product.name) + ' <span class="name-soft">x' + e.qty + '</span></span><span class="price">' + (e.product.price * e.qty) + ' \u20BD</span></div>';
      }).join("");
      summaryHtml = (
        '<div class="order-summary">' +
          '<div class="order-board-head">' +
            '<div class="order-num-control">' +
              '<button class="order-num-btn" data-action="order-num-minus" aria-label="Уменьшить номер">' + iconSvg("minus", 12) + '</button>' +
              '<span class="order-num-value">№' + state.orderCounter + '</span>' +
              '<button class="order-num-btn plus" data-action="order-num-plus" aria-label="Увеличить номер">' + iconSvg("plus", 12) + '</button>' +
            '</div>' +
            '<h2>Заказ</h2>' +
          '</div>' +
          '<div>' + lines + '</div>' +
          '<div class="order-total"><span>Итого</span><span class="sum">' + orderTotal() + ' \u20BD</span></div>' +
          '<div class="prep-row">' +
            '<span class="prep-label">' + iconSvg("clock", 16) + ' Время приготовления</span>' +
            '<div class="prep-controls">' +
              '<button class="prep-btn" data-action="prep-minus" aria-label="Уменьшить">' + iconSvg("minus", 14) + '</button>' +
              '<span class="prep-value">' + state.prepTime + ' мин</span>' +
              '<button class="prep-btn plus" data-action="prep-plus" aria-label="Увеличить">' + iconSvg("plus", 14) + '</button>' +
            '</div>' +
          '</div>' +
          '<button class="copy-btn" data-action="add-to-queue">' + iconSvg("plus", 16) + ' Добавить в очередь</button>' +
        '</div>'
      );
    }

    return (
      '<div class="pills">' + pills + '</div>' +
      '<div class="products">' + productsHtml + '</div>' +
      summaryHtml
    );
  }

  function renderAdmin() {
    var catRows = state.categories.map(function (c) {
      return (
        '<div class="cat-row">' +
          '<span class="label"><span class="icon-lg">' + c.icon + '</span>' + esc(c.name) + '</span>' +
          '<button class="del-btn" data-action="del-cat" data-id="' + c.id + '" aria-label="Удалить категорию ' + esc(c.name) + '">' + iconSvg("trash", 17) + '</button>' +
        '</div>'
      );
    }).join("");

    var addCatBlock = state.addingCategory
      ? (
        '<div class="add-cat-form">' +
          '<div class="emoji-grid">' + EMOJI_OPTIONS.map(function (e) {
            return '<button class="emoji-opt' + (e === state.newCatIcon ? " selected" : "") + '" data-action="pick-emoji" data-emoji="' + e + '">' + e + '</button>';
          }).join("") + '</div>' +
          '<input type="text" id="new-cat-name" placeholder="Название категории" value="' + esc(state.newCatName) + '" />' +
          '<div class="form-actions">' +
            '<button class="btn-primary" data-action="save-cat">' + iconSvg("check", 16) + ' Сохранить</button>' +
            '<button class="btn-ghost" data-action="cancel-cat">' + iconSvg("close", 16) + '</button>' +
          '</div>' +
        '</div>'
      )
      : '<button class="dashed-btn" data-action="start-add-cat">' + iconSvg("plus", 16) + ' Добавить категорию</button>';

    var prodGroups = state.categories.map(function (cat) {
      var rows = state.products.filter(function (p) { return p.categoryId === cat.id; }).map(function (p) {
        return (
          '<div class="prod-edit-row">' +
            '<input type="text" value="' + esc(p.name) + '" data-action="edit-name" data-id="' + p.id + '" />' +
            '<input type="number" value="' + p.price + '" data-action="edit-price" data-id="' + p.id + '" />' +
            '<span class="currency">\u20BD</span>' +
            '<button class="del-btn" data-action="del-prod" data-id="' + p.id + '" aria-label="Удалить ' + esc(p.name) + '">' + iconSvg("trash", 16) + '</button>' +
          '</div>'
        );
      }).join("");

      var addRow = state.addingProductFor === cat.id
        ? (
          '<div class="add-prod-row">' +
            '<input type="text" id="new-prod-name" placeholder="Название товара" />' +
            '<input type="number" id="new-prod-price" placeholder="Цена" />' +
            '<button class="icon-square confirm" data-action="save-prod" data-id="' + cat.id + '">' + iconSvg("check", 16) + '</button>' +
            '<button class="icon-square cancel" data-action="cancel-prod">' + iconSvg("close", 16) + '</button>' +
          '</div>'
        )
        : '<button class="add-prod-link" data-action="start-add-prod" data-id="' + cat.id + '">' + iconSvg("plus", 14) + ' Добавить товар</button>';

      return '<div><p class="prod-group-title"><span>' + cat.icon + '</span> ' + esc(cat.name) + '</p>' + rows + addRow + '</div>';
    }).join("");

    return (
      '<div class="admin-wrap">' +
        '<section><h2 class="section-title">Настройки</h2>' +
          '<input type="text" id="company-name-input" placeholder="Название компании" value="' + esc(state.companyName) + '" />' +
        '</section>' +
        '<section><h2 class="section-title">Категории</h2>' + catRows + addCatBlock + '</section>' +
        '<section><h2 class="section-title">Товары</h2>' + prodGroups + '</section>' +
      '</div>'
    );
  }

  function renderNotifications() {
    return (
      '<div class="admin-wrap">' +
        '<section>' +
          '<p class="empty">Пока нет уведомлений.</p>' +
        '</section>' +
      '</div>'
    );
  }

  function renderReport() {
    var tabs = [
      { id: "orders", label: "Заказы" },
      { id: "waiting", label: "Ожидания" },
      { id: "debts", label: "Долги" },
      { id: "paid", label: "Погашенные" }
    ];
    var tabsHtml = tabs.map(function (t) {
      var active = state.report.section === t.id;
      return '<button class="pill' + (active ? " active" : "") + '" data-action="report-tab" data-id="' + t.id + '">' + t.label + '</button>';
    }).join("");

    var body;
    if (state.report.section === "orders") body = renderReportOrders();
    else if (state.report.section === "waiting") body = renderReportWaiting();
    else if (state.report.section === "paid") body = renderReportPaid();
    else body = renderReportDebts();

    return '<div class="admin-wrap"><div class="pills report-tabs">' + tabsHtml + '</div>' + body + '</div>';
  }

  function renderReportOrders() {
    var monthKey = state.report.month;
    var dayKey = state.report.day;

    var monthOpts = monthOptions().map(function (m) {
      return '<option value="' + m + '"' + (m === monthKey ? " selected" : "") + '>' + monthLabel(m) + '</option>';
    }).join("");

    var numDays = daysInMonth(monthKey);
    var dayButtons = "";
    for (var d = 1; d <= numDays; d++) {
      var dKey = monthKey + "-" + pad2(d);
      var active = dKey === dayKey;
      dayButtons += '<button class="day-pill' + (active ? " active" : "") + '" data-action="report-day" data-id="' + dKey + '">' + d + '</button>';
    }

    var monthTotal = sumTotals(ordersForMonth(monthKey));
    var dayOrders = ordersForDay(dayKey);
    var dayTotal = sumTotals(dayOrders);

    var ordersListHtml = dayOrders.length === 0
      ? '<p class="empty">В этот день заказов нет.</p>'
      : '<div class="orders-list">' + dayOrders.map(function (o) {
          var itemsSummary = o.items.map(function (it) { return it.name + " x" + it.qty; }).join(", ");
          return (
            '<div class="product-card">' +
              '<div class="product-info">' +
                '<span class="product-name">Заказ №' + o.number + ' <span class="name-soft">' + o.time + '</span></span>' +
                '<span class="order-items-summary">' + esc(itemsSummary) + '</span>' +
              '</div>' +
              '<span class="product-price">' + o.total + ' \u20BD</span>' +
            '</div>'
          );
        }).join("") + '</div>';

    var dayDateLabel = dayKey.split("-").reverse().join(".");

    return (
      '<section>' +
        '<select class="month-select" data-action="report-month">' + monthOpts + '</select>' +
        '<div class="day-strip">' + dayButtons + '</div>' +
        '<div class="turnover-row">' +
          '<div class="turnover-card"><span class="turnover-label">Оборот за месяц</span><span class="turnover-value">' + monthTotal + ' \u20BD</span></div>' +
          '<div class="turnover-card"><span class="turnover-label">Оборот за день</span><span class="turnover-value">' + dayTotal + ' \u20BD</span></div>' +
        '</div>' +
        '<h2 class="section-title">Заказы за ' + dayDateLabel + '</h2>' +
        ordersListHtml +
      '</section>'
    );
  }

  function renderQueue() {
    var body = state.queue.length === 0
      ? '<p class="empty">Очередь пуста.</p>'
      : '<div class="orders-list queue-list">' + state.queue.slice().reverse().map(function (o) {
          var itemRows = o.items.map(function (it) {
            return '<div class="order-line"><span>' + iconForItem(it) + ' ' + esc(it.name) + ' <span class="name-soft">x' + it.qty + '</span></span><span class="price">' + (it.price * it.qty) + ' \u20BD</span></div>';
          }).join("");
          var copied = state.copiedOrderId === o.id;
          var expanded = state.expandedQueueId === o.id;
          var statusRow = expanded
            ? (
                '<div class="queue-status-row">' +
                  '<button class="status-btn waiting" data-action="queue-status" data-id="' + o.id + '" data-status="waiting">' + iconSvg("clock", 14) + ' В ожидании</button>' +
                  '<button class="status-btn paid" data-action="queue-status" data-id="' + o.id + '" data-status="paid">' + iconSvg("check", 14) + ' Оплачено</button>' +
                  '<button class="status-btn debt" data-action="queue-status" data-id="' + o.id + '" data-status="debt">' + iconSvg("debt", 14) + ' Долг</button>' +
                '</div>'
              )
            : "";
          return (
            '<div class="queue-card" data-action="toggle-queue-status" data-id="' + o.id + '">' +
              '<div class="queue-head">' +
                '<span class="queue-order-num">🧾 Заказ <span class="order-num-big">№' + o.number + '</span></span>' +
                '<div class="queue-badges">' +
                  '<span class="queue-badge">' + iconSvg("clock", 13) + ' ' + o.time + '</span>' +
                  '<span class="queue-badge prep">' + iconSvg("flame", 13) + ' ' + o.prepTime + ' мин</span>' +
                '</div>' +
              '</div>' +
              '<div class="queue-items">' + itemRows + '</div>' +
              '<div class="queue-total-row"><span class="queue-total-badge">' + o.total + ' \u20BD</span></div>' +
              statusRow +
              '<button class="copy-btn' + (copied ? " copied" : "") + '" data-action="copy-order-text" data-id="' + o.id + '">' +
                (copied ? iconSvg("check", 16) + ' Скопировано' : iconSvg("copy", 16) + ' Скопировать текст') +
              '</button>' +
            '</div>'
          );
        }).join("") + '</div>';
    return '<div class="admin-wrap"><section>' + body + '</section></div>';
  }

  function renderReportWaiting() {
    if (state.waitingPayment.length === 0) {
      return '<section><p class="empty">Нет заказов в ожидании оплаты.</p></section>';
    }
    var rows = state.waitingPayment.slice().reverse().map(function (o) {
      var itemsSummary = o.items.map(function (it) { return iconForItem(it) + " " + it.name + " x" + it.qty; }).join(", ");
      var expanded = state.expandedQueueId === o.id;
      var statusRow = expanded
        ? (
            '<div class="queue-status-row">' +
              '<button class="status-btn paid" data-action="queue-status" data-id="' + o.id + '" data-status="paid">' + iconSvg("check", 14) + ' Оплатил</button>' +
              '<button class="status-btn debt" data-action="queue-status" data-id="' + o.id + '" data-status="debt">' + iconSvg("debt", 14) + ' Долг</button>' +
            '</div>'
          )
        : "";
      return (
        '<div class="queue-card" data-action="toggle-queue-status" data-id="' + o.id + '">' +
          '<div class="queue-card-row">' +
            '<div class="product-info">' +
              '<span class="product-name">🧾 Заказ <span class="order-num-big">№' + o.number + '</span> <span class="name-soft">' + o.time + '</span></span>' +
              '<span class="order-items-summary">' + esc(itemsSummary) + '</span>' +
              '<span class="order-items-summary">' + iconSvg("clock", 13) + ' ' + o.prepTime + ' мин</span>' +
            '</div>' +
            '<span class="queue-total-badge">' + o.total + ' \u20BD</span>' +
          '</div>' +
          statusRow +
        '</div>'
      );
    }).join("");
    return '<section><div class="orders-list">' + rows + '</div></section>';
  }

  function renderReportDebts() {
    var openDebts = state.debts.filter(function (d) { return d.status !== "paid"; });
    if (openDebts.length === 0) {
      return '<section><p class="empty">Пока нет данных о долгах.</p></section>';
    }
    var rows = openDebts.slice().reverse().map(function (d) {
      var itemsSummary = d.items.map(function (it) { return it.name + " x" + it.qty; }).join(", ");
      var dueLabel = d.dueDate ? d.dueDate.split("-").reverse().join(".") : "не указана";
      var remaining = d.amount - (d.paidAmount || 0);
      var paidNote = d.paidAmount > 0 ? '<span class="order-items-summary">Оплачено: ' + d.paidAmount + ' \u20BD</span>' : "";
      return (
        '<div class="product-card" data-action="view-debt" data-id="' + d.id + '" role="button">' +
          '<div class="product-info">' +
            '<span class="product-name">' + esc(d.name) + ' <span class="name-soft">заказ №' + d.orderNumber + '</span></span>' +
            (d.phone ? '<span class="order-items-summary">' + esc(d.phone) + '</span>' : "") +
            (d.address ? '<span class="order-items-summary">' + esc(d.address) + '</span>' : "") +
            '<span class="order-items-summary">' + esc(itemsSummary) + '</span>' +
            '<span class="order-items-summary">' + iconSvg("clock", 13) + ' до ' + dueLabel + '</span>' +
            paidNote +
          '</div>' +
          '<div class="stepper">' +
            '<span class="product-price">' + remaining + ' \u20BD</span>' +
            '<button class="step-btn pay-btn" data-action="open-pay-form" data-id="' + d.id + '" aria-label="Оплатить">' + iconSvg("check", 14) + ' Оплатить</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
    return '<section><div class="orders-list">' + rows + '</div></section>';
  }

  function renderReportPaid() {
    var paidDebts = state.debts.filter(function (d) { return d.status === "paid"; });
    if (paidDebts.length === 0) {
      return '<section><p class="empty">Пока нет погашенных долгов.</p></section>';
    }
    var rows = paidDebts.slice().reverse().map(function (d) {
      var itemsSummary = d.items.map(function (it) { return it.name + " x" + it.qty; }).join(", ");
      var paidLabel = d.paidDate ? d.paidDate.split("-").reverse().join(".") : "";
      return (
        '<div class="product-card" data-action="view-debt" data-id="' + d.id + '" role="button">' +
          '<div class="product-info">' +
            '<span class="product-name">' + esc(d.name) + ' <span class="name-soft">заказ №' + d.orderNumber + '</span></span>' +
            (d.phone ? '<span class="order-items-summary">' + esc(d.phone) + '</span>' : "") +
            '<span class="order-items-summary">' + esc(itemsSummary) + '</span>' +
            '<span class="order-items-summary">' + iconSvg("check", 13) + ' погашено ' + paidLabel + '</span>' +
          '</div>' +
          '<span class="product-price">' + d.amount + ' \u20BD</span>' +
        '</div>'
      );
    }).join("");
    return '<section><div class="orders-list">' + rows + '</div></section>';
  }

  function renderDebtForm() {
    var f = state.debtForm;
    if (!f) return "";
    return (
      '<div class="admin-wrap"><section>' +
        '<div class="add-cat-form">' +
          '<input type="text" id="debt-name" placeholder="Имя" value="' + esc(f.name) + '" />' +
          '<input type="tel" id="debt-phone" placeholder="Номер телефона" value="' + esc(f.phone) + '" />' +
          '<input type="text" id="debt-address" placeholder="Адрес" value="' + esc(f.address) + '" />' +
          '<input type="number" id="debt-amount" placeholder="Сумма долга" value="' + f.amount + '" />' +
          '<label class="prep-label" style="margin-top:4px">Дата возврата долга</label>' +
          '<input type="date" id="debt-due" value="' + esc(f.dueDate) + '" />' +
          '<div class="form-actions">' +
            '<button class="btn-primary" data-action="save-debt">' + iconSvg("check", 16) + ' Сохранить</button>' +
            '<button class="btn-ghost" data-action="cancel-debt">' + iconSvg("close", 16) + '</button>' +
          '</div>' +
        '</div>' +
      '</section></div>'
    );
  }

  function renderPayForm() {
    var f = state.payForm;
    if (!f) return "";
    var debt = state.debts.filter(function (d) { return d.id === f.debtId; })[0];
    if (!debt) return "";
    var remaining = debt.amount - (debt.paidAmount || 0);
    return (
      '<div class="admin-wrap"><section>' +
        '<div class="add-cat-form">' +
          '<p class="prep-label">' + esc(debt.name) + ' — остаток ' + remaining + ' \u20BD</p>' +
          '<input type="number" id="pay-amount" placeholder="Сумма оплаты" value="' + remaining + '" />' +
          '<div class="form-actions">' +
            '<button class="btn-primary" data-action="save-payment">' + iconSvg("check", 16) + ' Оплатить</button>' +
            '<button class="btn-ghost" data-action="cancel-pay">' + iconSvg("close", 16) + '</button>' +
          '</div>' +
        '</div>' +
      '</section></div>'
    );
  }

  function renderDebtDetail() {
    var d = state.debts.filter(function (dd) { return dd.id === state.viewingDebtId; })[0];
    if (!d) return "";
    var itemsHtml = d.items.map(function (it) {
      return '<div class="order-line"><span>' + iconForItem(it) + ' ' + esc(it.name) + ' <span class="name-soft">x' + it.qty + '</span></span><span class="price">' + (it.price * it.qty) + ' \u20BD</span></div>';
    }).join("");
    var remaining = d.amount - (d.paidAmount || 0);
    var dueLabel = d.dueDate ? d.dueDate.split("-").reverse().join(".") : "не указана";
    var createdLabel = d.createdDate ? d.createdDate.split("-").reverse().join(".") : "";
    var statusBlock = d.status === "paid"
      ? '<div class="order-total"><span>Погашено</span><span class="sum">' + (d.paidDate ? d.paidDate.split("-").reverse().join(".") : "") + '</span></div>'
      : (
          '<div class="order-total"><span>Оплачено</span><span class="sum">' + (d.paidAmount || 0) + ' \u20BD</span></div>' +
          '<div class="order-total"><span>Остаток</span><span class="sum">' + remaining + ' \u20BD</span></div>' +
          '<button class="copy-btn" data-action="open-pay-form" data-id="' + d.id + '">' + iconSvg("check", 16) + ' Оплатить</button>'
        );
    return (
      '<div class="admin-wrap"><section>' +
        '<div class="order-summary">' +
          '<h2>' + esc(d.name) + '</h2>' +
          (d.phone ? '<div class="order-line"><span>Телефон</span><span>' + esc(d.phone) + '</span></div>' : "") +
          (d.address ? '<div class="order-line"><span>Адрес</span><span>' + esc(d.address) + '</span></div>' : "") +
          '<div class="order-line"><span>Заказ</span><span>№' + d.orderNumber + '</span></div>' +
          '<div class="order-line"><span>Оформлен</span><span>' + createdLabel + '</span></div>' +
          '<div class="order-line"><span>Срок возврата</span><span>' + dueLabel + '</span></div>' +
          itemsHtml +
          '<div class="order-total"><span>Сумма долга</span><span class="sum">' + d.amount + ' \u20BD</span></div>' +
          statusBlock +
        '</div>' +
      '</section></div>'
    );
  }

  function render() {
    var app = document.getElementById("app");
    var body;
    if (state.mode === "menu") body = renderMenu();
    else if (state.mode === "notifications") body = renderNotifications();
    else if (state.mode === "report") body = renderReport();
    else if (state.mode === "queue") body = renderQueue();
    else if (state.mode === "debt-form") body = renderDebtForm();
    else if (state.mode === "pay-debt-form") body = renderPayForm();
    else if (state.mode === "debt-detail") body = renderDebtDetail();
    else body = renderAdmin();
    app.innerHTML = renderHeader() + body;
    attachInputHandlers();
  }

  function attachInputHandlers() {
    var catNameInput = document.getElementById("new-cat-name");
    if (catNameInput) {
      catNameInput.addEventListener("input", function (e) { state.newCatName = e.target.value; });
      catNameInput.focus();
      catNameInput.setSelectionRange(catNameInput.value.length, catNameInput.value.length);
    }
    document.querySelectorAll('[data-action="edit-name"]').forEach(function (el) {
      el.addEventListener("input", function (e) { updateProductLive(e.target.getAttribute("data-id"), "name", e.target.value); });
    });
    document.querySelectorAll('[data-action="edit-price"]').forEach(function (el) {
      el.addEventListener("input", function (e) { updateProductLive(e.target.getAttribute("data-id"), "price", e.target.value); });
    });
    var companyNameInput = document.getElementById("company-name-input");
    if (companyNameInput) {
      companyNameInput.addEventListener("input", function (e) { updateCompanyName(e.target.value); });
    }
    var debtNameInput = document.getElementById("debt-name");
    if (debtNameInput) {
      debtNameInput.focus();
    }
    var payAmountInput = document.getElementById("pay-amount");
    if (payAmountInput) {
      payAmountInput.focus();
      payAmountInput.select();
    }
    var monthSelect = document.querySelector('[data-action="report-month"]');
    if (monthSelect) {
      monthSelect.addEventListener("change", function (e) {
        state.report.month = e.target.value;
        state.report.day = state.report.month === currentMonthKey() ? todayKey() : state.report.month + "-01";
        render();
      });
    }
  }

  function handleClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");
    switch (action) {
      case "open-admin": state.mode = "admin"; render(); break;
      case "open-notifications": state.mode = "notifications"; render(); break;
      case "open-report":
        state.mode = "report";
        state.report = { section: "orders", month: currentMonthKey(), day: todayKey() };
        render();
        break;
      case "open-menu": state.mode = "menu"; render(); break;
      case "open-queue": state.mode = "queue"; render(); break;
      case "report-tab": state.report.section = id; render(); break;
      case "report-day": state.report.day = id; render(); break;
      case "select-cat": state.activeCategory = id; render(); break;
      case "inc": increment(id); break;
      case "dec": decrement(id); break;
      case "prep-minus": changePrepTime(-5); break;
      case "prep-plus": changePrepTime(5); break;
      case "add-to-queue": addToQueue(); break;
      case "queue-done": completeQueueOrder(id); break;
      case "copy-order-text": copyOrderText(id); break;
      case "open-debt-form": openDebtForm(id); break;
      case "save-debt": saveDebt(); break;
      case "cancel-debt": cancelDebtForm(); break;
      case "open-pay-form": openPayForm(id); break;
      case "save-payment": savePayment(); break;
      case "cancel-pay": cancelPayForm(); break;
      case "toggle-queue-status": state.expandedQueueId = (state.expandedQueueId === id ? null : id); render(); break;
      case "queue-status":
        var status = el.getAttribute("data-status");
        if (status === "paid") { state.expandedQueueId = null; completeQueueOrder(id); }
        else if (status === "debt") { state.expandedQueueId = null; openDebtForm(id); }
        else if (status === "waiting") { state.expandedQueueId = null; moveOrderToWaiting(id); render(); }
        else { state.expandedQueueId = null; render(); }
        break;
      case "view-debt": state.viewingDebtId = id; state.mode = "debt-detail"; render(); break;
      case "back-to-report": state.viewingDebtId = null; state.mode = "report"; render(); break;
      case "order-num-minus": changeOrderCounter(-1); break;
      case "order-num-plus": changeOrderCounter(1); break;
      case "start-add-cat": state.addingCategory = true; state.newCatName = ""; state.newCatIcon = "🍔"; render(); break;
      case "cancel-cat": state.addingCategory = false; render(); break;
      case "save-cat": addCategory(); break;
      case "pick-emoji": state.newCatIcon = el.getAttribute("data-emoji"); render(); break;
      case "del-cat": deleteCategory(id); break;
      case "start-add-prod": state.addingProductFor = id; render(); break;
      case "cancel-prod": state.addingProductFor = null; render(); break;
      case "save-prod": addProduct(id); break;
      case "del-prod": deleteProduct(id); break;
    }
  }

  var swipeStartX = 0;
  var swipeStartY = 0;
  var swipeActive = false;

  function handleTouchStart(e) {
    if (state.mode !== "menu" && state.mode !== "queue") return;
    var target = e.target;
    if (target.closest && (target.closest(".pills") || target.closest(".day-strip"))) return;
    var t = e.touches[0];
    swipeStartX = t.clientX;
    swipeStartY = t.clientY;
    swipeActive = true;
  }

  function handleTouchEnd(e) {
    if (!swipeActive) return;
    swipeActive = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - swipeStartX;
    var dy = t.clientY - swipeStartY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && state.mode === "menu") {
      state.mode = "queue";
      render();
    } else if (dx > 0 && state.mode === "queue") {
      state.mode = "menu";
      render();
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });

  loadData();
  loadOrders();
  loadQueue();
  loadWaitingPayment();
  loadDebts();
  loadOrderCounter();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function (err) {
        console.warn("SW registration failed", err);
      });
    });
  }
})();
