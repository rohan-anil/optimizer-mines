"use strict";

const state = {
  cookies: Number(localStorage.getItem("optimizerMinesCookies") || "0"),
  slots: {
    memory: null,
    direction: null,
    magnitude: null,
    decay: null
  },
  momentumMode: "nesterov",
  momentumStep: 0,
  momentumTrace: [],
  momentumTick: 0,
  kappaLog: 2,
  graftTick: 0,
  graftFormulaKey: "",
  forgeIndex: 0,
  forgeSelections: {},
  forgeAnswered: false,
  quizIndex: 0,
  quizAnswered: false,
  storyIndex: 0,
  coinDodges: 0,
  coinLastDodgeAt: 0,
  currentRoom: 0,
  music: {
    ctx: null,
    timer: null,
    step: 0,
    playing: false,
    master: null,
    wanted: false,
    unlockArmed: false,
    unlockHandler: null
  }
};

const storyPages = [
  {
    title: "The Slop Sorcerer",
    text: "Slop has taken over the Kingdom of Optimizers. Every update rule has been smeared into vibes, every benchmark into a foggy screenshot, and the true optimizer is locked below the palace mines."
  },
  {
    title: "The Stretched Bowl Curse",
    text: "The sorcerer's favorite spell stretches every loss bowl until one direction is steep, another is flat, and progress crawls. The curse has a name: condition number."
  },
  {
    title: "The Jailed Optimizer",
    text: "In the deepest cell, the optimizer still remembers the old spells: Nesterov lookahead, heavy-ball velocity, EMA filtering, grafting, weight decay, matrix signs, and honest convergence rates."
  },
  {
    title: "Enter The Mines",
    text: "You are the apprentice. Read the rate plots, rebuild the update rules, and name each optimizer correctly. Every correct answer earns Cookie points and cracks a bar in the prison gate."
  }
];

const momentumLessons = {
  nesterov: {
    title: "Nesterov Momentum",
    rate: "1 - 1/sqrt(kappa)",
    steps: [
      {
        cue: "two quadratic modes",
        text: "Start with the simplest ill-conditioned bowl: one slow direction with curvature mu and one fast direction with curvature L.",
        math: "\\[f(u,v)=\\frac{1}{2}\\mu u^2+\\frac{1}{2}Lv^2,\\qquad \\kappa=L/\\mu.\\]",
        note: "With gradient descent and eta=1/L, the fast v mode dies in one step, but the slow u mode only shrinks by 1-1/kappa."
      },
      {
        cue: "lookahead update",
        text: "Nesterov changes where the gradient is measured. It predicts a point y_k, then takes the gradient at y_k.",
        math: "\\[y_k=x_k+\\beta(x_k-x_{k-1}),\\qquad x_{k+1}=y_k-\\frac{1}{L}\\nabla f(y_k).\\]",
        note: "Visual cue: the blue ghost jumps ahead, then the yellow update descends from the ghost."
      },
      {
        cue: "per-mode recurrence",
        text: "On an eigen-direction with curvature lambda, the algorithm becomes a scalar two-step recurrence.",
        math: "\\[e_{k+1}=\\left(1-\\frac{\\lambda}{L}\\right)\\bigl((1+\\beta)e_k-\\beta e_{k-1}\\bigr).\\]",
        note: "A quadratic turns the optimizer into a polynomial acting separately on each curvature mode."
      },
      {
        cue: "fix the slow mode",
        text: "Choose beta so the slow mu mode is critically damped. Let s=sqrt(mu/L)=1/sqrt(kappa).",
        math: "\\[\\beta=\\frac{1-s}{1+s},\\qquad r^2-2(1-s)r+(1-s)^2=(r-(1-s))^2.\\]",
        note: "The slow error now contracts like 1-1/sqrt(kappa), replacing gradient descent's 1-1/kappa."
      },
      {
        cue: "fast mode is safe",
        text: "The fast L mode is not amplified: the prefactor 1-lambda/L is zero at lambda=L, and all modes in [mu,L] stay within the same radius.",
        math: "\\[\\lambda=L\\Rightarrow e_{k+1}=0,\\qquad \\rho\\le 1-s=1-1/\\sqrt\\kappa.\\]",
        note: "This is the condition-number story: acceleration improves the dependence from kappa to sqrt(kappa)."
      },
      {
        cue: "convex fallback",
        text: "If mu is unknown or zero, use the time-varying convex schedule. The proof uses the same smoothness inequality plus a telescoping potential.",
        math: "\\[t_0=1,\\quad t_{k+1}=\\frac{1+\\sqrt{1+4t_k^2}}{2},\\quad \\beta_k=\\frac{t_k-1}{t_{k+1}},\\quad f(x_k)-f^\\star\\le\\frac{2L\\|x_0-x^\\star\\|^2}{(k+1)^2}.\\]",
        note: "This is the global smooth-convex Nesterov theorem: O(1/k^2) without a known positive mu."
      }
    ]
  },
  heavyball: {
    title: "Heavy-ball Momentum",
    rate: "quadratic rho = (sqrt(kappa)-1)/(sqrt(kappa)+1)",
    steps: [
      {
        cue: "velocity state",
        text: "Heavy-ball stores velocity and pushes through the current gradient point.",
        math: "\\[x_{k+1}=x_k-\\eta\\nabla f(x_k)+\\beta(x_k-x_{k-1}).\\]",
        note: "Visual cue: the pink velocity arrow can overshoot the minimizer."
      },
      {
        cue: "same two-mode bowl",
        text: "Use the same quadratic with two curvatures. Diagonalizing A reduces the proof to independent scalar modes.",
        math: "\\[f(u,v)=\\frac{1}{2}\\mu u^2+\\frac{1}{2}Lv^2,\\qquad A=Q\\Lambda Q^T,\\qquad \\lambda\\in[\\mu,L].\\]",
        note: "The whole proof is now about the roots of one second-order polynomial."
      },
      {
        cue: "two-step recurrence",
        text: "Each eigen-direction becomes a scalar two-step recurrence.",
        math: "\\[e_{k+1}=(1+\\beta-\\eta\\lambda)e_k-\\beta e_{k-1},\\qquad r^2-(1+\\beta-\\eta\\lambda)r+\\beta=0.\\]",
        note: "The spectral radius of this recurrence is the contraction factor."
      },
      {
        cue: "match both ends",
        text: "Set the boundary modes to have equal root radius. The slow mu mode gets a double root +rho; the fast L mode gets a double root -rho.",
        math: "\\[\\eta^\\star=\\frac{4}{(\\sqrt L+\\sqrt\\mu)^2},\\quad \\beta^\\star=\\rho^2,\\quad \\rho=\\frac{\\sqrt L-\\sqrt\\mu}{\\sqrt L+\\sqrt\\mu}.\\]",
        note: "At lambda=mu the polynomial is (r-rho)^2. At lambda=L it is (r+rho)^2."
      },
      {
        cue: "condition number",
        text: "Writing kappa=L/mu gives the classic heavy-ball rate on strongly convex quadratics.",
        math: "\\[\\rho=\\frac{\\sqrt\\kappa-1}{\\sqrt\\kappa+1}=1-\\frac{2}{\\sqrt\\kappa+1},\\qquad \\|e_k\\|\\lesssim k\\rho^k,\\quad f(x_k)-f^\\star\\lesssim k^2\\rho^{2k}.\\]",
        note: "The plotted heavy-ball curve is this quadratic optimum. It is faster than the Nesterov curve here, but it is not the same global theorem."
      },
      {
        cue: "convex warning",
        text: "If mu=0, the condition number is infinite and a zero-curvature mode has a root at one.",
        math: "\\[\\lambda=0\\Rightarrow r^2-(1+\\beta)r+\\beta=0=(r-1)(r-\\beta).\\]",
        note: "So heavy-ball has a clean optimal quadratic story, but not the same global smooth-convex guarantee as Nesterov."
      }
    ]
  },
  ema: {
    title: "EMA Momentum",
    rate: "filter + spectral radius",
    steps: [
      {
        cue: "low-pass memory",
        text: "EMA momentum is a low-pass filter over recent gradients.",
        math: "\\[m_{k+1}=\\beta m_k+(1-\\beta)g_k,\\qquad x_{k+1}=x_k-\\eta m_{k+1}.\\]",
        note: "Visual cue: the green memory arrow lags behind the raw gradient."
      },
      {
        cue: "exponential window",
        text: "Unroll the recurrence to reveal the exponential weighting window.",
        math: "\\[m_k=(1-\\beta)\\sum_{i=0}^{k-1}\\beta^i g_{k-1-i}.\\]",
        note: "Recent gradients count most; old gradients decay geometrically."
      },
      {
        cue: "variance constant",
        text: "For stationary gradient noise, EMA reduces variance but does not magically accelerate convex optimization.",
        math: "\\[\\operatorname{Var}(m_\\infty)=\\frac{1-\\beta}{1+\\beta}\\operatorname{Var}(g),\\qquad N_{\\rm eff}\\approx\\frac{1+\\beta}{1-\\beta}.\\]",
        note: "It is a smoother gradient estimator. The step schedule still matters."
      },
      {
        cue: "spectral roots",
        text: "On a quadratic eigen-direction, EMA also induces a two-step recurrence, so the rate is again spectral.",
        math: "\\[e_{k+1}=(1+\\beta-\\eta(1-\\beta)\\lambda)e_k-\\beta e_{k-1}.\\]",
        note: "Stable roots give a linear rate; stochastic convex rates remain the usual decaying-step rates."
      },
      {
        cue: "convex rate inherited",
        text: "For convex stochastic optimization, EMA changes constants by filtering noise; the usual SGD-style rates come from the step schedule.",
        math: "\\[\\mathbb E[f(\\bar x_T)]-f^\\star=O(RG/\\sqrt T)\\quad\\text{with tuned decaying steps.}\\]",
        note: "EMA is best taught as memory in the gradient estimator, not as a separate acceleration theorem."
      }
    ]
  }
};

const labels = {
  memory: {
    none: "None",
    ema: "EMA",
    heavyball: "Heavy-ball",
    nesterov: "Nesterov"
  },
  direction: {
    sgd: "Gradient",
    adam: "Adam diag",
    muon: "Muon polar",
    shampoo: "Shampoo roots"
  },
  magnitude: {
    sgd: "SGD norm",
    sqrtN: "SQRT_N",
    adam: "Adam norm",
    self: "Own norm"
  },
  decay: {
    none: "None",
    coupled: "Coupled L2",
    adamw: "LR shrink",
    fixed: "Fixed shrink"
  }
};

const sourceVectors = {
  adam: { x: 0.62, y: -0.34, label: "Adam" },
  shampoo: { x: 0.45, y: -0.68, label: "Shampoo" },
  muon: { x: 0.78, y: -0.08, label: "Muon" },
  sgd: { x: 0.38, y: -0.48, label: "SGD" }
};

const magnitudeScales = {
  sqrtN: 0.78,
  sgd: 0.55,
  adam: 0.96,
  shampoo: 0.72
};

const slotShortLabels = {
  memory: {
    none: "None",
    ema: "EMA",
    heavyball: "HB",
    nesterov: "NAG"
  },
  direction: {
    sgd: "Grad",
    adam: "Diag",
    muon: "Polar",
    shampoo: "Root"
  },
  magnitude: {
    sgd: "SGD",
    sqrtN: "Rank",
    adam: "Adam",
    self: "Own"
  },
  decay: {
    none: "None",
    coupled: "L2",
    adamw: "LR",
    fixed: "Fixed"
  }
};

const texLabels = {
  sqrtN: "\\mathrm{SQRT\\_N}",
  sgd: "\\mathrm{SGD}",
  adam: "\\mathrm{Adam}",
  shampoo: "\\mathrm{Shampoo}",
  muon: "\\mathrm{Muon}"
};

const forgeRounds = [
  {
    name: "AdamW",
    desc: "Adaptive diagonal direction with EMA moments and decoupled learning-rate-scaled weight decay.",
    rule: "w_{t+1}=(1-\\eta\\lambda)w_t-\\eta\\hat m_t/(\\sqrt{\\hat v_t}+\\epsilon)",
    answer: { memory: "ema", direction: "adam", magnitude: "self", decay: "adamw" }
  },
  {
    name: "NAdam",
    desc: "Adam-style diagonal scaling, but the first-moment numerator uses a Nesterov lookahead flavor.",
    rule: "u_t=\\frac{\\beta_1\\hat m_t+(1-\\beta_1)g_t/(1-\\beta_1^t)}{\\sqrt{\\hat v_t}+\\epsilon}",
    answer: { memory: "nesterov", direction: "adam", magnitude: "self", decay: "adamw" }
  },
  {
    name: "Heavy-ball SGD",
    desc: "Velocity memory with raw gradient direction and ordinary SGD-scale magnitude.",
    rule: "v_t=\\beta v_{t-1}+g_t,\\qquad w_{t+1}=w_t-\\eta v_t",
    answer: { memory: "heavyball", direction: "sgd", magnitude: "sgd", decay: "none" }
  },
  {
    name: "Muon",
    desc: "Matrix momentum becomes a polar/sign direction through Newton-Schulz orthogonalization.",
    rule: "M_t=\\beta M_{t-1}+G_t,\\qquad \\Delta W_t=-\\eta\\operatorname{NS}(M_t)",
    answer: { memory: "heavyball", direction: "muon", magnitude: "self", decay: "none" }
  },
  {
    name: "Shampoo",
    desc: "Per-mode second-order statistics produce Kronecker inverse-root preconditioned directions.",
    rule: "\\Delta W_t=-\\eta L_t^{-1/4}G_tR_t^{-1/4}",
    answer: { memory: "ema", direction: "shampoo", magnitude: "self", decay: "none" }
  },
  {
    name: "Spectral Descent / Shampoo beta2=0",
    desc: "No second-moment averaging: instant Shampoo on one matrix collapses to the spectral sign direction.",
    rule: "G=U\\Sigma V^T,\\qquad L^{-1/4}GR^{-1/4}=UV^T",
    answer: { memory: "none", direction: "shampoo", magnitude: "sqrtN", decay: "none" }
  },
  {
    name: "Adam-grafted Muon",
    desc: "Use Muon's polar direction, but copy the layer-wise step norm from Adam.",
    rule: "\\Delta W_\\ell=-\\frac{\\|u_\\ell^{Adam}\\|_F}{\\|\\operatorname{NS}(M_\\ell)\\|_F+\\epsilon}\\operatorname{NS}(M_\\ell)",
    answer: { memory: "heavyball", direction: "muon", magnitude: "adam", decay: "adamw" }
  },
  {
    name: "Adam-grafted Shampoo",
    desc: "Use Shampoo inverse-root direction, but graft Adam's layer-wise magnitude.",
    rule: "\\Delta W_\\ell=-\\frac{\\|u_\\ell^{Adam}\\|_F}{\\|u_\\ell^{Shampoo}\\|_F+\\epsilon}u_\\ell^{Shampoo}",
    answer: { memory: "ema", direction: "shampoo", magnitude: "adam", decay: "adamw" }
  }
];

const quizRounds = [
  {
    name: "Adam",
    answers: ["Adam"],
    slots: ["EMA first moment", "diagonal RMS direction", "own adaptive step norm", "no decoupled decay"],
    rule: "\\hat m_t/(\\sqrt{\\hat v_t}+\\epsilon)",
    options: ["Adam", "NAdam", "Muon", "Shampoo"]
  },
  {
    name: "AdamW",
    answers: ["AdamW"],
    slots: ["EMA first moment", "diagonal RMS direction", "own adaptive step norm", "decoupled LR shrink"],
    rule: "w_{t+1}=(1-\\eta\\lambda)w_t-\\eta\\hat m_t/(\\sqrt{\\hat v_t}+\\epsilon)",
    options: ["AdamW", "Adam", "AdaMax", "Grafted Shampoo"]
  },
  {
    name: "NAdam",
    answers: ["NAdam", "Nesterov Adam"],
    slots: ["Nesterov lookahead moment", "diagonal RMS direction", "own adaptive step norm", "optional LR shrink"],
    rule: "\\text{Adam denominator with a Nesterov first-moment lookahead}",
    options: ["NAdam", "Nesterov Adam", "Heavy-ball SGD", "MuonW"]
  },
  {
    name: "Nesterov Accelerated Gradient",
    answers: ["Nesterov Accelerated Gradient", "Nesterov momentum"],
    slots: ["lookahead point y_k", "gradient at y_k", "1/L step", "no adaptive denominator"],
    rule: "y_k=x_k+\\beta_k(x_k-x_{k-1}),\\quad x_{k+1}=y_k-\\nabla f(y_k)/L",
    options: ["Nesterov Accelerated Gradient", "EMA momentum", "AdamW", "Shampoo beta2=0"]
  },
  {
    name: "AdaMax",
    answers: ["AdaMax"],
    slots: ["EMA first moment", "L-infinity second moment", "infinity-norm adaptive step", "no decoupled decay"],
    rule: "u_t=\\max(\\beta_2u_{t-1}, |g_t|),\\quad \\Delta w_t=-\\eta\\hat m_t/u_t",
    options: ["AdaMax", "Adam", "AdaGrad", "Spectral Shampoo beta2=0"]
  },
  {
    name: "Muon",
    answers: ["Muon"],
    slots: ["heavy-ball matrix momentum", "Newton-Schulz polar direction", "spectral / own norm", "usually no decay in the core rule"],
    rule: "M_t=\\beta M_{t-1}+G_t,\\quad \\Delta W_t=-\\eta\\,\\operatorname{NS}(M_t)",
    options: ["Muon", "AdamW", "Shampoo", "AdaMax"]
  },
  {
    name: "MuonW",
    answers: ["MuonW"],
    slots: ["heavy-ball matrix momentum", "Newton-Schulz polar direction", "spectral / own norm", "decoupled LR shrink"],
    rule: "W_{t+1}=(1-\\eta\\lambda)W_t-\\eta\\operatorname{NS}(M_t)",
    options: ["MuonW", "Muon", "AdamW", "NAdam"]
  },
  {
    name: "Adam-grafted Muon",
    answers: ["Adam-grafted Muon"],
    slots: ["heavy-ball matrix momentum", "Muon polar direction", "Adam layer step norm", "optional LR shrink"],
    rule: "\\Delta W_\\ell=-\\frac{\\|u^{Adam}_\\ell\\|_F}{\\|\\operatorname{NS}(M_\\ell)\\|_F+\\epsilon}\\operatorname{NS}(M_\\ell)",
    options: ["Adam-grafted Muon", "Muon", "AdamW", "Shampoo"]
  },
  {
    name: "Shampoo",
    answers: ["Shampoo"],
    slots: ["optional momentum", "Kronecker inverse-root direction", "own preconditioned norm", "optional coupled or decoupled decay"],
    rule: "\\Delta W_t=-\\eta L_t^{-1/4}G_tR_t^{-1/4}",
    options: ["Shampoo", "Muon", "AdaMax", "NAdam"]
  },
  {
    name: "Adam-grafted Shampoo",
    answers: ["Adam-grafted Shampoo"],
    slots: ["EMA moments", "Shampoo inverse-root direction", "Adam layer step norm", "decoupled LR shrink"],
    rule: "\\Delta W_\\ell=-\\frac{\\|u^{Adam}_\\ell\\|_F}{\\|u^{Shampoo}_\\ell\\|_F+\\epsilon}u^{Shampoo}_\\ell",
    options: ["Adam-grafted Shampoo", "AdamW", "MuonW", "Heavy-ball SGD"]
  },
  {
    name: "Spectral descent alias room",
    answers: ["Spectral Descent", "Shampoo beta2=0", "Muon"],
    slots: ["instant gradient statistics", "Shampoo/spectral direction", "own norm", "no second-moment averaging"],
    rule: "G=U\\Sigma V^T,\\quad L=GG^T,\\quad R=G^TG,\\quad L^{-1/4}GR^{-1/4}=UV^T",
    options: ["Spectral Descent", "Shampoo beta2=0", "Muon", "AdamW"]
  }
];

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function saveScore() {
  localStorage.setItem("optimizerMinesCookies", String(state.cookies));
  $("#cookieScore").textContent = String(state.cookies);
}

function addCookies(amount) {
  state.cookies += amount;
  saveScore();
}

function setFeedback(node, text, mode) {
  node.textContent = text;
  node.classList.remove("good", "bad");
  if (mode) node.classList.add(mode);
}

function typeset(node) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise(node ? [node] : undefined).catch(() => {});
  }
}

function roomScreens() {
  return $all(".room-screen");
}

function showRoom(index) {
  const rooms = roomScreens();
  if (!rooms.length) return;
  const clamped = Math.max(0, Math.min(index, rooms.length - 1));
  state.currentRoom = clamped;
  rooms.forEach((room, i) => room.classList.toggle("active", i === clamped));
  const active = rooms[clamped];
  $("#roomName").textContent = active.dataset.room || "Gate";
  $all("#roomDots button").forEach((button, i) => {
    button.classList.toggle("active", i === clamped);
    button.setAttribute("aria-current", i === clamped ? "step" : "false");
  });
  $("#prevRoom").disabled = clamped === 0;
  $("#nextRoom").disabled = clamped === rooms.length - 1;
  window.scrollTo({ top: 0, behavior: "auto" });
  typeset(active);
}

function nextRoom() {
  showRoom(state.currentRoom + 1);
}

function prevRoom() {
  showRoom(state.currentRoom - 1);
}

function setupRoomFlow() {
  const dots = $("#roomDots");
  dots.innerHTML = "";
  roomScreens().forEach((room, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.title = room.dataset.room || `Room ${index + 1}`;
    dot.setAttribute("aria-label", `Go to ${dot.title}`);
    dot.addEventListener("click", () => {
      ensureMusic();
      showRoom(index);
    });
    dots.appendChild(dot);
  });

  $("#nextRoom").addEventListener("click", () => {
    ensureMusic();
    nextRoom();
  });
  $("#prevRoom").addEventListener("click", () => {
    ensureMusic();
    prevRoom();
  });
  $all("[data-next-room]").forEach((button) => {
    button.addEventListener("click", () => {
      ensureMusic();
      nextRoom();
    });
  });
  $all("[data-prev-room]").forEach((button) => {
    button.addEventListener("click", () => {
      ensureMusic();
      prevRoom();
    });
  });
  $all("[data-go-room]").forEach((button) => {
    button.addEventListener("click", () => {
      ensureMusic();
      showRoom(Number(button.dataset.goRoom));
    });
  });
  showRoom(0);
}

function renderStory() {
  const page = storyPages[state.storyIndex];
  $("#storyTitle").textContent = page.title;
  $("#storyText").textContent = page.text;
  $("#storyBack").disabled = state.storyIndex === 0;
  $("#storyNext").textContent = state.storyIndex === storyPages.length - 1 ? "Enter mines" : "Next";
  const progress = $("#storyProgress");
  progress.innerHTML = "";
  storyPages.forEach((_page, index) => {
    const dot = document.createElement("span");
    dot.classList.toggle("active", index === state.storyIndex);
    progress.appendChild(dot);
  });
}

function closeStory() {
  $("#storyOverlay").classList.add("hidden");
  showRoom(0);
}

function closeCoinPopup() {
  const popup = $("#coinPopup");
  if (!popup) return;
  popup.classList.add("hidden");
  const story = $("#storyOverlay");
  if (story) {
    story.classList.remove("hidden");
    renderStory();
  }
}

function moveCoinClose(force = false) {
  const popup = $("#coinPopup");
  const paper = popup?.querySelector(".coin-paper");
  const close = $("#coinClose");
  const hint = $("#coinCloseHint");
  if (!popup || !paper || !close || popup.classList.contains("hidden")) return;
  if (state.coinDodges >= 3) {
    close.classList.add("catchable");
    close.textContent = "ok";
    close.setAttribute("aria-label", "Close derivation popup");
    return;
  }
  const now = performance.now();
  if (!force && now - state.coinLastDodgeAt < 350) return;
  state.coinLastDodgeAt = now;
  state.coinDodges += 1;
  const paperRect = paper.getBoundingClientRect();
  const closeRect = close.getBoundingClientRect();
  const pad = 14;
  const mobilePopup = window.matchMedia("(max-width: 560px), (pointer: coarse)").matches;
  if (mobilePopup) {
    const minX = Math.max(pad, paperRect.left + pad);
    const maxX = Math.max(minX, Math.min(window.innerWidth - closeRect.width - pad, paperRect.right - closeRect.width - pad));
    const minY = Math.max(pad, paperRect.top + pad);
    const maxY = Math.max(minY, Math.min(window.innerHeight - closeRect.height - pad, paperRect.top + 210));
    const previousX = parseFloat(close.style.left);
    const previousY = parseFloat(close.style.top);
    let x = minX + Math.random() * (maxX - minX);
    let y = minY + Math.random() * (maxY - minY);
    if (Number.isFinite(previousX) && Number.isFinite(previousY) && maxX - minX > 72) {
      let attempts = 0;
      while (Math.hypot(x - previousX, y - previousY) < 86 && attempts < 8) {
        x = minX + Math.random() * (maxX - minX);
        y = minY + Math.random() * (maxY - minY);
        attempts += 1;
      }
    }
    close.style.top = `${y}px`;
    close.style.left = `${x}px`;
    close.style.right = "auto";
    if (hint) {
      const hintWidth = Math.min(hint.getBoundingClientRect().width || 190, paperRect.width - closeRect.width - 42);
      const hintX = x + closeRect.width + 8 + hintWidth < paperRect.right - pad
        ? x + closeRect.width + 8
        : Math.max(paperRect.left + pad, x - hintWidth - 8);
      hint.style.left = `${hintX}px`;
      hint.style.top = `${Math.max(paperRect.top + pad, y + 7)}px`;
      hint.style.right = "auto";
      hint.textContent = state.coinDodges >= 3
        ? "x button stabilized"
        : `x button is ill-conditioned ${state.coinDodges}/3`;
    }
    close.classList.add("evading");
    window.setTimeout(() => close.classList.remove("evading"), 170);
    if (state.coinDodges >= 3) {
      close.classList.add("catchable");
      close.textContent = "ok";
      close.setAttribute("aria-label", "Close derivation popup");
    }
    return;
  }
  const maxX = Math.max(pad, paperRect.width - closeRect.width - pad);
  const maxY = Math.max(pad, Math.min(170, paperRect.height - closeRect.height - pad));
  const x = pad + Math.random() * (maxX - pad);
  const y = pad + Math.random() * (maxY - pad);
  close.style.left = `${x}px`;
  close.style.top = `${y}px`;
  close.style.right = "auto";
  if (hint) {
    const hintWidth = hint.getBoundingClientRect().width || 190;
    const hintX = x + closeRect.width + 9 + hintWidth < paperRect.width - pad
      ? x + closeRect.width + 9
      : Math.max(pad, x - hintWidth - 9);
    hint.style.left = `${hintX}px`;
    hint.style.top = `${y + 7}px`;
    hint.style.right = "auto";
  }
  close.classList.add("evading");
  window.setTimeout(() => close.classList.remove("evading"), 170);
  if (state.coinDodges >= 3) {
    window.setTimeout(() => {
      close.classList.add("catchable");
      close.textContent = "ok";
      close.setAttribute("aria-label", "Close derivation popup");
      if (hint) hint.textContent = "x button stabilized";
    }, 210);
  }
}

function setupCoinPopup() {
  const popup = $("#coinPopup");
  const close = $("#coinClose");
  const paper = popup?.querySelector(".coin-paper");
  const continueButton = $("#coinContinue");
  if (!popup || !close || !paper || !continueButton) return;

  close.addEventListener("pointerenter", moveCoinClose);
  close.addEventListener("click", () => {
    ensureMusic();
    if (state.coinDodges < 3) {
      moveCoinClose(true);
      playBlip("bad");
      return;
    }
    closeCoinPopup();
    playBlip("good");
  });
  continueButton.addEventListener("click", () => {
    ensureMusic();
    closeCoinPopup();
    playBlip("good");
  });
  paper.addEventListener("pointermove", (event) => {
    if (popup.classList.contains("hidden")) return;
    const rect = close.getBoundingClientRect();
    const closeX = rect.left + rect.width / 2;
    const closeY = rect.top + rect.height / 2;
    const distance = Math.hypot(event.clientX - closeX, event.clientY - closeY);
    if (distance < 82) moveCoinClose();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.classList.contains("hidden")) {
      closeCoinPopup();
    }
  });
}

function setupStory() {
  renderStory();
  $("#storyNext").addEventListener("click", () => {
    ensureMusic();
    if (state.storyIndex < storyPages.length - 1) {
      state.storyIndex += 1;
      renderStory();
      playBlip("good");
    } else {
      closeStory();
      playBlip("win");
    }
  });
  $("#storyBack").addEventListener("click", () => {
    if (state.storyIndex > 0) {
      state.storyIndex -= 1;
      renderStory();
      playBlip("good");
    }
  });
  $("#storySkip").addEventListener("click", () => {
    ensureMusic();
    closeStory();
  });
}

function setupRoomObserver() {
  const roomName = $("#roomName");
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) roomName.textContent = visible.target.dataset.room || "Gate";
  }, { threshold: [0.25, 0.45, 0.7] });
  $all("[data-room]").forEach((room) => observer.observe(room));
}

function loss(x) {
  return 0.5 * x * x + 0.06 * Math.sin(2.7 * x + 0.3) + 0.08;
}

function grad(x) {
  return x + 0.162 * Math.cos(2.7 * x + 0.3);
}

function renderMomentumLesson() {
  const lesson = momentumLessons[state.momentumMode];
  const step = lesson.steps[state.momentumStep];
  $("#momentumLessonTitle").textContent = lesson.title;
  $("#momentumStepLabel").textContent = `Step ${state.momentumStep + 1} / ${lesson.steps.length}`;
  $("#momentumLessonText").textContent = step.text;
  $("#momentumLessonMath").innerHTML = step.math;
  $("#momentumLessonNote").textContent = step.note;
  $("#prevMomentumStep").disabled = state.momentumStep === 0;
  $("#nextMomentumStep").textContent = state.momentumStep === lesson.steps.length - 1 ? "Restart derivation" : "Next derivation";
  typeset($("#momentumLessonMath"));
}

function nextMomentumStep() {
  const lesson = momentumLessons[state.momentumMode];
  state.momentumStep = (state.momentumStep + 1) % lesson.steps.length;
  renderMomentumLesson();
}

function prevMomentumStep() {
  const lesson = momentumLessons[state.momentumMode];
  state.momentumStep = Math.max(0, Math.min(lesson.steps.length - 1, state.momentumStep - 1));
  renderMomentumLesson();
}

function resetMomentum(mode = state.momentumMode) {
  state.momentumMode = mode;
  state.momentumTick = 0;
  state.momentumTrace = [{ x: 2.55, y: loss(2.55), v: 0, m: 0, prevX: 2.75, t: 1, look: 2.55, nextX: 2.55 }];
}

function stepMomentum() {
  const last = state.momentumTrace[state.momentumTrace.length - 1];
  let next;

  if (state.momentumMode === "heavyball") {
    const eta = 0.28;
    const beta = 0.72;
    const v = beta * last.v + grad(last.x);
    const x = last.x - eta * v;
    next = { ...last, prevX: last.x, x, y: loss(x), v, look: last.x, nextX: x };
  } else if (state.momentumMode === "ema") {
    const eta = 0.48;
    const beta = 0.86;
    const m = beta * last.m + (1 - beta) * grad(last.x);
    const x = last.x - eta * m;
    next = { ...last, prevX: last.x, x, y: loss(x), m, look: last.x - m, nextX: x };
  } else {
    const eta = 0.42;
    const tNext = (1 + Math.sqrt(1 + 4 * last.t * last.t)) / 2;
    const beta = (last.t - 1) / tNext;
    const yLook = last.x + beta * (last.x - last.prevX);
    const x = yLook - eta * grad(yLook);
    next = { ...last, prevX: last.x, x, y: loss(x), t: tNext, look: yLook, nextX: x };
  }

  if (!Number.isFinite(next.x) || Math.abs(next.x) > 6) {
    resetMomentum();
    return;
  }
  state.momentumTrace.push(next);
  if (state.momentumTrace.length > 54) state.momentumTrace.shift();
}

function drawCanvasArrow(ctx, from, to, color, label) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 14 * Math.cos(angle - 0.45), to.y - 14 * Math.sin(angle - 0.45));
  ctx.lineTo(to.x - 14 * Math.cos(angle + 0.45), to.y - 14 * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = "15px Courier New";
    ctx.fillText(label, to.x + 8, to.y - 8);
  }
  ctx.restore();
}

function drawMomentum() {
  const canvas = $("#momentumCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0f1020";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < w; i += 24) {
    ctx.fillStyle = i % 48 === 0 ? "#1d2542" : "#161b31";
    ctx.fillRect(i, 0, 3, h);
  }
  for (let y = 0; y < h; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? "#1d2542" : "#161b31";
    ctx.fillRect(0, y, w, 3);
  }

  const toX = (x) => 70 + ((x + 3) / 6) * (w - 140);
  const toY = (y) => h - 54 - (y / 5.5) * (h - 105);

  ctx.strokeStyle = "#f2c94c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const x = -3 + (i / 160) * 6;
    const px = toX(x);
    const py = toY(loss(x));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.strokeStyle = "#53405b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(52, h - 54);
  ctx.lineTo(w - 50, h - 54);
  ctx.stroke();

  const trace = state.momentumTrace;
  ctx.lineWidth = 3;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1];
    const b = trace[i];
    ctx.strokeStyle = state.momentumMode === "nesterov" ? "#20c6b7" : state.momentumMode === "heavyball" ? "#f04872" : "#58d66d";
    ctx.globalAlpha = 0.25 + 0.75 * (i / trace.length);
    ctx.beginPath();
    ctx.moveTo(toX(a.x), toY(a.y));
    ctx.lineTo(toX(b.x), toY(b.y));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const cur = trace[trace.length - 1];
  const prev = trace[Math.max(0, trace.length - 2)];
  const lookX = Number.isFinite(cur.look) ? cur.look : cur.x;
  const nextX = Number.isFinite(cur.nextX) ? cur.nextX : cur.x;
  const currentPoint = { x: toX(cur.x), y: toY(cur.y) };
  const lookPoint = { x: toX(lookX), y: toY(loss(lookX)) };
  const nextPoint = { x: toX(nextX), y: toY(loss(nextX)) };

  if (state.momentumMode === "nesterov") {
    drawCanvasArrow(ctx, currentPoint, lookPoint, "#367cf6", "lookahead");
    drawCanvasArrow(ctx, lookPoint, nextPoint, "#f2c94c", "gradient step");
    ctx.fillStyle = "#367cf6";
    ctx.fillRect(lookPoint.x - 6, lookPoint.y - 6, 12, 12);
  } else if (state.momentumMode === "heavyball") {
    const velocityPoint = { x: toX(cur.x + (cur.x - prev.x) * 1.15), y: toY(loss(cur.x)) };
    drawCanvasArrow(ctx, currentPoint, velocityPoint, "#f04872", "velocity");
    drawCanvasArrow(ctx, currentPoint, nextPoint, "#f2c94c", "update");
  } else {
    const rawGradPoint = { x: toX(cur.x - grad(cur.x) * 0.55), y: toY(loss(cur.x)) };
    const emaPoint = { x: toX(cur.x - cur.m * 1.4), y: toY(loss(cur.x)) };
    drawCanvasArrow(ctx, currentPoint, rawGradPoint, "#f04872", "raw g");
    drawCanvasArrow(ctx, currentPoint, emaPoint, "#58d66d", "EMA m");
    drawCanvasArrow(ctx, currentPoint, nextPoint, "#f2c94c", "update");
  }

  ctx.fillStyle = "#fff4c6";
  ctx.fillRect(toX(cur.x) - 8, toY(cur.y) - 8, 16, 16);
  ctx.fillStyle = "#080711";
  ctx.fillRect(toX(cur.x) - 3, toY(cur.y) - 3, 6, 6);

  ctx.fillStyle = "#d4bc8c";
  ctx.font = "18px Courier New";
  ctx.fillText("convex bowl f(x)", 26, 30);
  ctx.fillText("x*", toX(0) - 8, h - 22);
  const lesson = momentumLessons[state.momentumMode];
  const step = lesson.steps[state.momentumStep];
  ctx.fillStyle = "#20c6b7";
  ctx.font = "15px Courier New";
  ctx.fillText(`derivation ${state.momentumStep + 1}/${lesson.steps.length}`, w - 220, 30);
  ctx.fillStyle = "#fff0c2";
  ctx.fillText(step.cue, w - 220, 53);

  const lossValue = Math.max(0, cur.y - loss(0));
  $("#simLoss").textContent = `loss ${lossValue.toFixed(4)}`;
}

function currentKappa() {
  const slider = $("#kappaSlider");
  const logValue = slider ? Number(slider.value) : state.kappaLog;
  state.kappaLog = Number.isFinite(logValue) ? logValue : 2;
  return Math.max(1, Math.round(10 ** state.kappaLog));
}

function emaSpectralRadius(kappa, beta = 0.9) {
  let worst = 0;
  for (let i = 0; i <= 96; i += 1) {
    const lambdaOverL = (1 / kappa) + (i / 96) * (1 - 1 / kappa);
    const a = 1 + beta - (1 - beta) * lambdaOverL;
    const discriminant = a * a - 4 * beta;
    let radius;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      radius = Math.max(Math.abs((a + root) / 2), Math.abs((a - root) / 2));
    } else {
      radius = Math.sqrt(beta);
    }
    worst = Math.max(worst, radius);
  }
  return Math.min(0.9999, worst);
}

function rateFactors(kappa) {
  const rootKappa = Math.sqrt(kappa);
  return {
    gd: Math.max(0, 1 - 1 / kappa),
    nag: Math.max(0, 1 - 1 / rootKappa),
    hb: Math.max(0, (rootKappa - 1) / (rootKappa + 1)),
    ema: emaSpectralRadius(kappa)
  };
}

function drawRateCurve(ctx, factor, color, area, maxStep, dash = []) {
  const floor = 1e-4;
  const logFloor = Math.log10(floor);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let step = 0; step <= maxStep; step += 1) {
    const error = step === 0 ? 1 : Math.max(floor, factor ** step);
    const logError = Math.log10(error);
    const x = area.left + (step / maxStep) * area.width;
    const y = area.top + ((0 - logError) / (0 - logFloor)) * area.height;
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRatePlot() {
  const canvas = $("#rateCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const kappa = currentKappa();
  const factors = rateFactors(kappa);
  const maxStep = 160;
  const area = { left: 64, top: 22, width: w - 96, height: h - 78 };

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#090914";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#1d2542";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    const y = area.top + (i / 4) * area.height;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = area.left + (i / 4) * area.width;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.top + area.height);
    ctx.stroke();
  }

  drawRateCurve(ctx, factors.gd, "#367cf6", area, maxStep);
  drawRateCurve(ctx, factors.nag, "#20c6b7", area, maxStep);
  drawRateCurve(ctx, factors.hb, "#f04872", area, maxStep, [10, 7]);
  drawRateCurve(ctx, factors.ema, "#58d66d", area, maxStep);

  ctx.strokeStyle = "#53405b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.top + area.height);
  ctx.lineTo(area.left + area.width, area.top + area.height);
  ctx.stroke();

  ctx.fillStyle = "#d4bc8c";
  ctx.font = "15px Courier New";
  ctx.fillText("mode error, log scale", 16, 18);
  ctx.fillText("training steps", area.left + area.width - 140, h - 18);
  ["1", "1e-1", "1e-2", "1e-3", "1e-4"].forEach((label, i) => {
    const y = area.top + (i / 4) * area.height + 5;
    ctx.fillText(label, 12, y);
  });
  [0, 40, 80, 120, 160].forEach((step, i) => {
    const x = area.left + (i / 4) * area.width - 8;
    ctx.fillText(String(step), x, h - 42);
  });

  $("#kappaValue").textContent = String(kappa);
  $("#kappaBadge").textContent = `kappa=${kappa}`;
  $("#rateReadout").textContent =
    `Mode-error factors at kappa=${kappa}: GD ${factors.gd.toFixed(3)}, Nesterov ${factors.nag.toFixed(3)}, ` +
    `heavy-ball quadratic-only ${factors.hb.toFixed(3)}, EMA beta=0.9 ${factors.ema.toFixed(3)}. Smaller is faster.`;
}

function momentumLoop() {
  state.momentumTick += 1;
  if (state.momentumTick % 15 === 0) stepMomentum();
  drawMomentum();
  drawRatePlot();
  requestAnimationFrame(momentumLoop);
}

function setMomentumMode(mode) {
  state.momentumMode = mode;
  state.momentumStep = 0;
  resetMomentum(mode);
  $all(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.momentum === mode);
  });
  $("#simMode").textContent = mode === "heavyball" ? "Heavy-ball" : mode === "ema" ? "EMA" : "Nesterov";
  $("#simRate").textContent = momentumLessons[mode].rate;
  renderMomentumLesson();
}

function drawArrow(ctx, origin, vector, scale, color, label) {
  const end = {
    x: origin.x + vector.x * scale,
    y: origin.y + vector.y * scale
  };
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const angle = Math.atan2(end.y - origin.y, end.x - origin.x);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - 18 * Math.cos(angle - 0.45), end.y - 18 * Math.sin(angle - 0.45));
  ctx.lineTo(end.x - 18 * Math.cos(angle + 0.45), end.y - 18 * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.font = "16px Courier New";
  const labelX = Math.max(12, Math.min(ctx.canvas.width - 118, end.x + 10));
  const labelY = Math.max(24, Math.min(ctx.canvas.height - 14, end.y - 8));
  ctx.fillText(label, labelX, labelY);
}

function updateGraftFormula() {
  const dirKey = $("#graftDirection").value;
  const magKey = $("#graftMagnitude").value;
  const key = `${dirKey}:${magKey}`;
  if (key === state.graftFormulaKey) return;
  state.graftFormulaKey = key;
  const formula = $("#graftFormula");
  formula.innerHTML = `\\[
    \\Delta W_\\ell =
    \\frac{\\|u^{${texLabels[magKey]}}_\\ell\\|_F}
    {\\|u^{${texLabels[dirKey]}}_\\ell\\|_F+\\epsilon}
    u^{${texLabels[dirKey]}}_\\ell
  \\]`;
  $("#graftReadout").textContent = `${sourceVectors[dirKey].label} supplies direction. ${labels.magnitude[magKey]} supplies layer-wise length. The final update keeps the blue angle and the pink length.`;
  typeset(formula);
}

function drawGraftPanel(ctx, x, y, width, height, title) {
  ctx.fillStyle = "#090914";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#58354b";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#d4bc8c";
  ctx.font = "15px Courier New";
  ctx.fillText(title, x + 16, y + 28);
}

function drawGraft() {
  const canvas = $("#graftCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  state.graftTick += 1;
  const pulse = 0.86 + 0.14 * Math.sin(state.graftTick / 18);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#070812";
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 24) {
    ctx.fillStyle = x % 48 === 0 ? "#18223d" : "#11182d";
    ctx.fillRect(x, 0, 3, h);
  }
  for (let y = 0; y < h; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? "#18223d" : "#11182d";
    ctx.fillRect(0, y, w, 3);
  }

  const dirKey = $("#graftDirection").value;
  const magKey = $("#graftMagnitude").value;
  const layerScale = Number($("#layerScale").value);
  const dir = sourceVectors[dirKey];
  const rawLength = Math.hypot(dir.x, dir.y);
  const unit = { x: dir.x / rawLength, y: dir.y / rawLength };
  const magnitude = magnitudeScales[magKey] * layerScale;

  drawGraftPanel(ctx, 22, 42, 176, 266, "1 direction");
  drawGraftPanel(ctx, 222, 42, 176, 266, "2 magnitude");
  drawGraftPanel(ctx, 422, 42, 176, 266, "3 graft");

  const dirOrigin = { x: 70, y: 246 };
  const magOrigin = { x: 260, y: 246 };
  const finalOrigin = { x: 458, y: 246 };
  const dirScale = 112 * pulse;
  const magScale = 48 + Math.min(74, 48 * magnitude);
  const finalScale = magScale * pulse;

  ctx.fillStyle = "#f2c94c";
  [dirOrigin, magOrigin, finalOrigin].forEach((p) => ctx.fillRect(p.x - 6, p.y - 6, 12, 12));
  drawArrow(ctx, dirOrigin, unit, dirScale, "#367cf6", `${dir.label}`);
  drawArrow(ctx, magOrigin, { x: 1, y: 0 }, magScale, "#f04872", `${labels.magnitude[magKey]}`);
  drawArrow(ctx, finalOrigin, unit, finalScale, "#58d66d", "update");

  ctx.strokeStyle = "#f04872";
  ctx.lineWidth = 3;
  ctx.strokeRect(244, 92, 132, 28);
  ctx.fillStyle = "#f04872";
  ctx.fillRect(248, 96, Math.min(124, 46 + 44 * magnitude), 20);
  ctx.fillStyle = "#fff0c2";
  ctx.font = "13px Courier New";
  ctx.fillText(`layer scale ${layerScale.toFixed(2)}`, 242, 142);

  ctx.fillStyle = "#20c6b7";
  ctx.font = "15px Courier New";
  ctx.fillText("direction normalized", 44, 322);
  ctx.fillText("length copied", 250, 322);
  ctx.fillText("angle + length", 448, 322);
  requestAnimationFrame(drawGraft);
}

function setupGrafting() {
  ["#graftDirection", "#graftMagnitude", "#layerScale"].forEach((selector) => {
    $(selector).addEventListener("input", () => {
      updateGraftFormula();
    });
  });
  updateGraftFormula();
  requestAnimationFrame(drawGraft);
}

function memoryFormula(memory) {
  if (memory === "ema") return "m_t=\\beta_1m_{t-1}+(1-\\beta_1)g_t";
  if (memory === "heavyball") return "m_t=\\beta m_{t-1}+g_t";
  if (memory === "nesterov") return "g_t=\\nabla f(w_t+\\beta(w_t-w_{t-1}))";
  return "m_t=g_t";
}

function directionFormula(direction) {
  if (direction === "adam") return "d_t=\\hat m_t/(\\sqrt{\\hat v_t}+\\epsilon)";
  if (direction === "muon") return "d_t=\\operatorname{NS}(M_t)\\approx\\operatorname{polar}(M_t)";
  if (direction === "shampoo") return "d_t=L_t^{-1/4}m_tR_t^{-1/4}";
  return "d_t=m_t";
}

function magnitudeFormula(magnitude) {
  if (magnitude === "sqrtN") return "a_t=\\eta\\sqrt{r_\\ell},\\quad r_\\ell=\\operatorname{rank}(d_{t,\\ell})";
  if (magnitude === "adam") return "a_t=\\|u^{Adam}_{t,\\ell}\\|_F";
  if (magnitude === "self") return "a_t=\\eta\\|d_{t,\\ell}\\|_F";
  return "a_t=\\eta\\|m_{t,\\ell}\\|_F";
}

function decayFormula(decay) {
  if (decay === "coupled") return "g_t\\leftarrow g_t+\\lambda w_t";
  if (decay === "adamw") return "w_{t+1}=(1-\\eta\\lambda)w_t+\\Delta w_t";
  if (decay === "fixed") return "w_{t+1}=(1-\\lambda)w_t+\\Delta w_t";
  return "w_{t+1}=w_t+\\Delta w_t";
}

function allSlotsFilled() {
  return Object.values(state.slots).every(Boolean);
}

function updateRule() {
  const rule = $("#updateRule");
  if (!allSlotsFilled()) {
    rule.textContent = "Select one option in every slot to reveal the optimizer spell.";
    return;
  }

  const { memory, direction, magnitude, decay } = state.slots;
  const isGrafted = magnitude !== "self";
  const update = isGrafted
    ? "\\Delta w_{t,\\ell}=-\\frac{a_t}{\\|d_{t,\\ell}\\|_F+\\epsilon}d_{t,\\ell}"
    : "\\Delta w_t=-\\eta d_t";

  rule.innerHTML = `\\[
    ${memoryFormula(memory)},\\qquad
    ${directionFormula(direction)},\\qquad
    ${magnitudeFormula(magnitude)}
  \\]
  \\[
    ${update},\\qquad ${decayFormula(decay)}
  \\]`;
  typeset(rule);

  setFeedback($("#forgeFeedback"), "Slots complete. Check them against the target spell.", "good");
}

function updateForgeMachine(result = null, mistakes = []) {
  const filled = Object.values(state.forgeSelections).filter(Boolean).length;
  const charge = $("#forgeCharge");
  if (charge) charge.style.width = `${(filled / 4) * 100}%`;

  const machine = $("#forgeMachine");
  if (machine) {
    machine.classList.toggle("forged", result === "good");
    machine.classList.toggle("alarm", result === "bad");
  }

  ["memory", "direction", "magnitude", "decay"].forEach((slot) => {
    const socket = $(`#forgeSocket-${slot}`);
    if (!socket) return;
    const value = state.forgeSelections[slot];
    socket.classList.toggle("filled", Boolean(value));
    socket.classList.toggle("correct", result === "good" && Boolean(value));
    socket.classList.toggle("wrong", result === "bad" && mistakes.includes(slot));
    socket.querySelector("strong").textContent = value ? slotShortLabels[slot][value] : "?";
  });

  const quest = $("#forgeQuestCopy");
  if (!quest) return;
  if (result === "good") {
    quest.textContent = "The artifact locks in. The slop seal cracks and the update rule is clean.";
  } else if (result === "bad") {
    quest.textContent = "The forge sputters. Swap the red sockets and try sealing the spell again.";
  } else if (filled === 4) {
    quest.textContent = "All four sockets are charged. Strike Check slots to seal the artifact.";
  } else {
    quest.textContent = `${4 - filled} socket${filled === 3 ? "" : "s"} still dark. Match the spell before the slop fog returns.`;
  }
}

function resetForgeSelections() {
  state.forgeSelections = {};
  state.forgeAnswered = false;
  state.slots = { memory: null, direction: null, magnitude: null, decay: null };
  $all(".forge-choice").forEach((button) => {
    button.classList.remove("selected", "correct", "wrong");
    button.disabled = false;
  });
  $("#updateRule").textContent = "Select one option in every slot to reveal the optimizer spell.";
  updateForgeMachine();
  setFeedback($("#forgeFeedback"), "Pick the four slots that match the target spell.", null);
}

function setForgeRound(index) {
  const round = forgeRounds[index % forgeRounds.length];
  state.forgeIndex = index % forgeRounds.length;
  $("#forgeRoundCounter").textContent = `Round ${state.forgeIndex + 1} / ${forgeRounds.length}`;
  $("#forgeQuestTitle").textContent = `Forge ${round.name}`;
  $("#forgeTargetName").textContent = round.name;
  $("#forgeTargetDesc").textContent = round.desc;
  $("#forgeTargetRule").innerHTML = `\\[${round.rule}\\]`;
  ["memory", "direction", "magnitude", "decay"].forEach((group) => {
    const container = $(`#forgeChoices-${group}`);
    container.innerHTML = "";
    Object.entries(labels[group]).forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "forge-choice";
      button.dataset.group = group;
      button.dataset.value = value;
      button.textContent = label;
      button.addEventListener("click", () => selectForgeChoice(group, value));
      container.appendChild(button);
    });
  });
  resetForgeSelections();
  typeset($("#forgeTargetRule"));
}

function selectForgeChoice(group, value) {
  ensureMusic();
  if (state.forgeAnswered) return;
  $all(".forge-choice").forEach((button) => button.classList.remove("correct", "wrong"));
  $all(".forge-socket").forEach((socket) => socket.classList.remove("correct", "wrong"));
  $("#forgeMachine").classList.remove("forged", "alarm");
  state.forgeSelections[group] = value;
  state.slots[group] = value;
  $all(`.forge-choice[data-group="${group}"]`).forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === value);
  });
  updateRule();
  updateForgeMachine();
}

function checkForgeRound() {
  ensureMusic();
  if (state.forgeAnswered) {
    setFeedback($("#forgeFeedback"), "This spell is already sealed. Use Next forge round.", "good");
    return;
  }
  const round = forgeRounds[state.forgeIndex];
  const missing = ["memory", "direction", "magnitude", "decay"].filter((slot) => !state.forgeSelections[slot]);
  if (missing.length) {
    setFeedback($("#forgeFeedback"), `Still missing: ${missing.join(", ")}.`, "bad");
    playBlip("bad");
    return;
  }

  const mistakes = [];
  Object.entries(round.answer).forEach(([group, expected]) => {
    const chosen = state.forgeSelections[group];
    $all(`.forge-choice[data-group="${group}"]`).forEach((button) => {
      const isExpected = button.dataset.value === expected;
      const isChosen = button.dataset.value === chosen;
      button.classList.toggle("correct", isExpected);
      button.classList.toggle("wrong", isChosen && !isExpected);
    });
    if (chosen !== expected) mistakes.push(group);
  });

  if (mistakes.length === 0) {
    state.forgeAnswered = true;
    $all(".forge-choice").forEach((button) => {
      button.disabled = true;
    });
    addCookies(3);
    updateForgeMachine("good");
    setFeedback($("#forgeFeedback"), `Correct. ${round.name} earns 3 Cookie points.`, "good");
    playForgeSound("success");
  } else {
    updateForgeMachine("bad", mistakes);
    const fixes = mistakes.map((group) => `${group}: ${labels[group][round.answer[group]]}`);
    setFeedback($("#forgeFeedback"), `Not yet. Fix highlighted slots: ${fixes.join("; ")}.`, "bad");
    playForgeSound("fail");
  }
}

function setupForgePuzzle() {
  $("#checkForge").addEventListener("click", checkForgeRound);
  $("#nextForgeRound").addEventListener("click", () => {
    ensureMusic();
    setForgeRound(state.forgeIndex + 1);
  });
  setForgeRound(0);
}

function setQuizRound(index) {
  const round = quizRounds[index % quizRounds.length];
  state.quizIndex = index % quizRounds.length;
  state.quizAnswered = false;
  ["memory", "direction", "magnitude", "decay"].forEach((slot, i) => {
    $(`#quiz-${slot}`).textContent = round.slots[i];
  });
  $("#quizPrompt").textContent = (round.answers && round.answers.length > 1) ? "Pick any accepted name for this rule." : "Which optimizer is this?";
  $("#quizRule").innerHTML = `\\[${round.rule}\\]`;
  const options = $("#quizOptions");
  options.innerHTML = "";
  round.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => answerQuiz(option, button));
    options.appendChild(button);
  });
  setFeedback($("#quizFeedback"), "Choose a gate name.", null);
  typeset($("#quizRule"));
}

function answerQuiz(option, button) {
  ensureMusic();
  if (state.quizAnswered) return;
  const round = quizRounds[state.quizIndex];
  state.quizAnswered = true;
  const answers = round.answers || [round.name];
  const correct = answers.includes(option);
  if (correct) {
    button.classList.add("correct");
    addCookies(2);
    $all("#quizOptions button").forEach((candidate) => {
      if (answers.includes(candidate.textContent)) candidate.classList.add("correct");
    });
    setFeedback($("#quizFeedback"), `Correct. Accepted: ${answers.join(" / ")}. +2 Cookie points.`, "good");
    playBlip("win");
  } else {
    button.classList.add("wrong");
    $all("#quizOptions button").forEach((candidate) => {
      if (answers.includes(candidate.textContent)) candidate.classList.add("correct");
    });
    setFeedback($("#quizFeedback"), `Not this gate. Accepted: ${answers.join(" / ")}.`, "bad");
    playBlip("bad");
  }
}

function setupQuiz() {
  $("#nextRound").addEventListener("click", () => {
    ensureMusic();
    setQuizRound(state.quizIndex + 1);
  });
  setQuizRound(0);
}

function setupMomentumControls() {
  $all(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      ensureMusic();
      setMomentumMode(button.dataset.momentum);
    });
  });
  $("#nextMomentumStep").addEventListener("click", () => {
    ensureMusic();
    nextMomentumStep();
  });
  $("#prevMomentumStep").addEventListener("click", () => {
    ensureMusic();
    prevMomentumStep();
  });
  $("#kappaSlider").addEventListener("input", () => {
    ensureMusic();
    drawRatePlot();
  });
  resetMomentum("nesterov");
  $("#simRate").textContent = momentumLessons.nesterov.rate;
  renderMomentumLesson();
  drawRatePlot();
  requestAnimationFrame(momentumLoop);
}

function playBlip(kind) {
  const audio = state.music;
  if (!audio.ctx || audio.ctx.state !== "running") return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "bad" ? 120 : kind === "win" ? 660 : 440;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === "win" ? 0.1 : 0.06, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "win" ? 0.18 : 0.08));
  osc.connect(gain);
  gain.connect(audio.master || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

function playNoiseBurst(time, duration = 0.05, gainValue = 0.04) {
  const audio = state.music;
  const ctx = audio.ctx;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const fade = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(audio.master);
  src.start(time);
}

function playForgeSound(kind = "success") {
  const audio = state.music;
  if (!audio.ctx || audio.ctx.state !== "running" || !audio.master) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime + 0.01;
  if (kind === "fail") {
    [0, 0.12].forEach((offset, i) => {
      playNoiseBurst(now + offset, 0.09, 0.075);
      playNote(i === 0 ? 98 : 73.42, now + offset, 0.14, 0.055, "sawtooth");
    });
    playNote(61.74, now + 0.27, 0.2, 0.045, "triangle");
    return;
  }

  [0, 0.1, 0.2].forEach((offset, i) => {
    playNoiseBurst(now + offset, 0.045, 0.055);
    playNote([164.81, 196, 246.94][i], now + offset, 0.08, 0.045, "square");
  });
  [329.63, 392, 493.88, 659.25].forEach((freq, i) => {
    playNote(freq, now + 0.3 + i * 0.055, 0.09, 0.05, i % 2 ? "triangle" : "square");
  });
}

function playNote(freq, time, duration, gainValue, type = "square") {
  const audio = state.music;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playNoise(time) {
  playNoiseBurst(time, 0.05, 0.04);
}

function musicStep() {
  const audio = state.music;
  if (!audio.playing || !audio.ctx || audio.ctx.state !== "running") return;
  const scale = [196, 220, 233.08, 261.63, 293.66, 311.13, 349.23, 392];
  const melody = [0, 2, 3, 5, 7, 5, 3, 2, 0, 2, 5, 3, 2, 0, 3, 2];
  const bass = [0, 0, 0, 0, 5, 5, 5, 5, 3, 3, 3, 3, 2, 2, 2, 2];
  const step = audio.step % melody.length;
  const now = audio.ctx.currentTime;
  playNote(scale[melody[step]], now, 0.12, 0.055, "square");
  if (step % 4 === 0) playNote(scale[bass[step]] / 2, now, 0.18, 0.045, "triangle");
  if (step % 4 === 2) playNoise(now);
  audio.step += 1;
}

function mobileAudioGate() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function setupAudioContext() {
  const audio = state.music;
  if (!audio.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      audio.ctx = new AudioContext();
    } catch (_error) {
      updateMusicUi("Click anywhere to wake the chiptune crystal.");
      return false;
    }
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.28;
    audio.master.connect(audio.ctx.destination);
  }
  return true;
}

function primeAudioOutput() {
  const audio = state.music;
  if (!audio.ctx || !audio.master || audio.ctx.state !== "running") return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.07);
}

function updateMusicUi(statusText) {
  const toggle = $("#musicToggle");
  if (toggle) toggle.textContent = state.music.wanted ? "Stop music" : "Start music";
  const status = $("#audioStatus");
  if (status && statusText) status.textContent = statusText;
}

function beginMusicPlayback() {
  const audio = state.music;
  if (!audio.wanted || !audio.ctx || audio.ctx.state !== "running") return;
  const wasPlaying = audio.playing;
  audio.playing = true;
  updateMusicUi("Music crystal active.");
  primeAudioOutput();
  if (!wasPlaying) musicStep();
  if (!audio.timer) audio.timer = window.setInterval(musicStep, 150);
}

function armMusicUnlock() {
  const audio = state.music;
  if (audio.unlockArmed) return;
  audio.unlockArmed = true;
  audio.unlockHandler = () => {
    if (!state.music.wanted) return;
    startMusic(true);
    if (state.music.playing && state.music.unlockHandler) {
      ["pointerdown", "pointerup", "click", "keydown", "touchstart", "touchend"].forEach((eventName) => {
        document.removeEventListener(eventName, state.music.unlockHandler, true);
      });
      state.music.unlockArmed = false;
      state.music.unlockHandler = null;
    }
  };
  ["pointerdown", "pointerup", "click", "keydown", "touchstart", "touchend"].forEach((eventName) => {
    document.addEventListener(eventName, audio.unlockHandler, true);
  });
}

function startMusic(fromGesture = false) {
  const audio = state.music;
  audio.wanted = true;
  armMusicUnlock();
  if (!fromGesture && mobileAudioGate() && !audio.ctx) {
    updateMusicUi("Tap anywhere to wake the chiptune crystal.");
    return;
  }
  updateMusicUi("Music crystal waking. Click anywhere if the browser guards the gate.");
  if (!setupAudioContext()) return;
  if (audio.ctx.state === "suspended") {
    let resume;
    try {
      resume = audio.ctx.resume();
    } catch (_error) {
      updateMusicUi("Click anywhere to wake the chiptune crystal.");
      return;
    }
    if (resume && typeof resume.then === "function") {
      resume.then(beginMusicPlayback).catch(() => {
        updateMusicUi("Click anywhere to wake the chiptune crystal.");
      });
    }
    return;
  }
  beginMusicPlayback();
}

function stopMusic() {
  const audio = state.music;
  audio.wanted = false;
  audio.playing = false;
  if (audio.timer) window.clearInterval(audio.timer);
  audio.timer = null;
  updateMusicUi("Music crystal sleeping.");
}

function ensureMusic(fromGesture = true) {
  const audio = state.music;
  if (!audio.playing || !audio.wanted || audio.ctx?.state === "suspended") startMusic(fromGesture);
}

function setupMusic() {
  $("#musicToggle").addEventListener("click", () => {
    if (state.music.wanted) stopMusic();
    else startMusic(true);
  });
  startMusic();
}

function setupReset() {
  $("#resetGame").addEventListener("click", () => {
    state.cookies = 0;
    saveScore();
    setForgeRound(0);
    setQuizRound(0);
    playBlip("good");
  });
}

function setup() {
  saveScore();
  setupMusic();
  setupCoinPopup();
  setupStory();
  setupRoomFlow();
  setupReset();
  setupMomentumControls();
  setupGrafting();
  setupForgePuzzle();
  setupQuiz();
  typeset(document.body);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}
