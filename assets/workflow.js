{
  const flow = document.querySelector(".campaign-flow");
  const graph = flow.querySelector(".flow-graph");
  const wires = graph.querySelector(".flow-wires");
  const toggle = flow.querySelector("[data-flow-toggle]");
  const singlePass = flow.hasAttribute("data-flow-once");
  const nodes = [...graph.querySelectorAll("[data-flow-node]")];
  const nodeByName = new Map(nodes.map((node) => [node.dataset.flowNode, node]));
  const stacked = matchMedia("(max-width: 50rem)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const links = nodes.flatMap((to) => {
    if (!to.dataset.flowFrom) return [];
    return to.dataset.flowFrom.split(" ").map((name) => ({
      from: nodeByName.get(name),
      to,
    }));
  });

  const connections = links.map(({ from, to }) => {
    const wire = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const signal = wire.cloneNode();
    wire.setAttribute("class", "flow-wire");
    signal.setAttribute("class", "flow-signal");
    signal.setAttribute("pathLength", "1");
    wires.append(wire, signal);
    return { from, to, wire, signal };
  });

  function drawConnections() {
    const bounds = graph.getBoundingClientRect();
    const vertical = stacked.matches;

    connections.forEach(({ from, to, wire, signal }) => {
      const start = from.getBoundingClientRect();
      const end = to.getBoundingClientRect();
      const x1 = (vertical ? start.left + start.width / 2 : start.right) - bounds.left;
      const y1 = (vertical ? start.bottom : start.top + start.height / 2) - bounds.top;
      const x2 = (vertical ? end.left + end.width / 2 : end.left) - bounds.left;
      const y2 = (vertical ? end.top : end.top + end.height / 2) - bounds.top;
      const middleX = (x1 + x2) / 2;
      const middleY = (y1 + y2) / 2;
      const curve = vertical
        ? `${x1} ${middleY} ${x2} ${middleY}`
        : `${middleX} ${y1} ${middleX} ${y2}`;
      const path = `M ${x1} ${y1} C ${curve} ${x2} ${y2}`;
      wire.setAttribute("d", path);
      signal.setAttribute("d", path);
    });
  }

  let stage = 0;
  let timer;
  let frame;
  let inView = false;
  let paused = false;
  let hasPlayed = false;

  function showStage() {
    nodes.forEach((node) => {
      node.toggleAttribute("data-active", Number(node.dataset.stage) === stage);
    });
    connections.forEach(({ from, to, signal }) => {
      const active = stage === 0
        ? Number(from.dataset.stage) === 0
        : Number(to.dataset.stage) === stage;
      signal.toggleAttribute("data-active", active);
    });
  }

  function stopPlayback() {
    clearInterval(timer);
    cancelAnimationFrame(frame);
    flow.removeAttribute("data-playing");
  }

  function playOnce() {
    hasPlayed = true;
    const start = performance.now();

    function advance(now) {
      const nextStage = Math.floor((now - start) / 1100);
      if (nextStage >= 4) {
        stopPlayback();
        return;
      }
      if (nextStage !== stage && nextStage >= 0) {
        stage = nextStage;
        showStage();
      }
      frame = requestAnimationFrame(advance);
    }

    frame = requestAnimationFrame(advance);
  }

  function updatePlayback() {
    const playing = inView && !paused && !reducedMotion.matches && !document.hidden;
    if (toggle) {
      toggle.hidden = reducedMotion.matches;
      toggle.textContent = paused ? "Resume animation" : "Pause animation";
    }

    if (!playing) {
      stopPlayback();
      return;
    }
    if (flow.hasAttribute("data-playing") || (singlePass && hasPlayed)) return;

    flow.setAttribute("data-playing", "");
    if (singlePass) {
      playOnce();
      return;
    }

    timer = setInterval(() => {
      stage = (stage + 1) % 4;
      showStage();
    }, 3200);
  }

  const resize = new ResizeObserver(drawConnections);
  [graph, ...nodes].forEach((element) => resize.observe(element));
  stacked.addEventListener("change", drawConnections);

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePlayback();
  });
  visibility.observe(graph);

  toggle?.addEventListener("click", () => {
    paused = !paused;
    updatePlayback();
  });
  reducedMotion.addEventListener("change", updatePlayback);
  document.addEventListener("visibilitychange", updatePlayback);
  drawConnections();
  showStage();
  updatePlayback();
}
