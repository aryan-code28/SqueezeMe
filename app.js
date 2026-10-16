(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { mode: "reduce", file: null, resultBlob: null, resultName: "", busy: false };
  const allowed = /\.(jpe?g|png|webp|pdf)$/i;

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
  const isPdf = (file) => file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  const setStatus = (message) => $("status").textContent = message;
  function progress(value, message) {
    $("progressWrap").classList.remove("hidden");
    $("progressBar").style.width = `${Math.max(0, Math.min(100, value))}%`;
    $("progressPercent").textContent = `${Math.round(value)}%`;
    $("progressText").textContent = message;
  }
  function resetResult() {
    $("resultPanel").classList.add("hidden");
    state.resultBlob = null;
  }
  function chooseFile(file) {
    if (!file) return;
    if (!allowed.test(file.name)) {
      setStatus("Unsupported file. Choose JPG, PNG, WEBP or PDF.");
      return;
    }
    state.file = file;
    resetResult();
    $("fileInfo").classList.remove("hidden");
    $("fileBadge").textContent = isPdf(file) ? "PDF" : "IMG";
    $("fileName").textContent = file.name;
    $("fileSize").textContent = formatSize(file.size);
    $("fileTitle").textContent = file.name;
    $("fileSub").textContent = "Selected and ready to process";
    $("processBtn").disabled = false;
    setStatus("File selected. Configure your settings and start.");
  }
  function setMode(mode) {
    state.mode = mode;
    const reduce = mode === "reduce";
    $("reduceTab").classList.toggle("active", reduce);
    $("enhanceTab").classList.toggle("active", !reduce);
    $("reduceTab").setAttribute("aria-selected", String(reduce));
    $("enhanceTab").setAttribute("aria-selected", String(!reduce));
    $("reducerSettings").classList.toggle("hidden", !reduce);
    $("enhancerSettings").classList.toggle("hidden", reduce);
    $("settingsTitle").textContent = reduce ? "Reducer settings" : "Enhancer settings";
    $("processIcon").textContent = reduce ? "↓" : "✦";
    $("processLabel").textContent = reduce ? "SQUEEZE IT!" : "ENHANCE IT!";
    resetResult();
    setStatus(`${reduce ? "Reducer" : "Enhancer"} mode selected.`);
  }
  function imageToCanvas(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be opened.")); };
      image.src = url;
    });
  }
  function canvasBlob(canvas, quality, type = "image/jpeg") {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }
  function makeCanvas(image, scale = 1, strength = "balanced") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (strength !== "none") {
      const amount = strength === "strong" ? 1.18 : strength === "sharp" ? 1.12 : 1.06;
      const contrast = strength === "strong" ? 1.13 : strength === "sharp" ? 1.10 : 1.06;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let v = (d[i+c] - 128) * contrast + 128;
          v = 128 + (v - 128) * amount;
          d[i+c] = Math.max(0, Math.min(255, v));
        }
      }
      ctx.putImageData(pixels, 0, 0);
    }
    return canvas;
  }
  async function reduceImage(file, targetBytes) {
    const image = await imageToCanvas(file);
    let best = null, bestSize = Infinity;
    const scales = [1,.9,.8,.7,.6,.5,.4,.3,.25,.2,.15];
    const qualities = [.92,.84,.76,.68,.6,.52,.44,.36,.28,.2,.12];
    let tries = 0, total = scales.length * qualities.length;
    for (const scale of scales) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for (const quality of qualities) {
        const blob = await canvasBlob(canvas, quality);
        tries++;
        progress(tries / total * 90, "Trying image size and quality combinations…");
        if (blob && blob.size < bestSize) { best = blob; bestSize = blob.size; }
        if (blob && blob.size <= targetBytes) return blob;
      }
    }
    if (!best) throw new Error("The browser could not encode this image.");
    return best;
  }
  async function enhanceImage(file) {
    const image = await imageToCanvas(file);
    const scale = Number($("scale").value);
    const strength = $("strength").value;
    const canvas = makeCanvas(image, scale, strength);
    progress(85, "Preparing enhanced image…");
    const blob = await canvasBlob(canvas, .95);
    if (!blob) throw new Error("Could not create the enhanced image.");
    return blob;
  }
  async function loadPdf(file) {
    if (!window.pdfjsLib) throw new Error("PDF tools did not load. Check your internet connection and refresh this page.");
    const data = await file.arrayBuffer();
    return pdfjsLib.getDocument({data: new Uint8Array(data)}).promise;
  }
  async function renderPdf(file, options = {}) {
    const pdf = await loadPdf(file);
    const { targetBytes = Infinity, enhance = false, maxMode = false } = options;
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error("PDF export tools did not load. Check your internet connection and refresh.");
    const dpiList = maxMode ? [130,110,90,75,60,50,40] : enhance ? [180] : [150,130,110,90,75,60];
    let bestBlob = null;
    for (let attempt = 0; attempt < dpiList.length; attempt++) {
      const dpi = dpiList[attempt];
      const doc = new jsPDF({unit:"pt", format:"a4", compress:true});
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({scale:dpi/72});
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", {alpha:false});
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:ctx, viewport}).promise;
        if (enhance) {
          const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
          const d = pixels.data;
          for (let i=0;i<d.length;i+=4) for(let c=0;c<3;c++) d[i+c]=Math.max(0,Math.min(255,128+(d[i+c]-128)*1.12));
          ctx.putImageData(pixels,0,0);
        }
        const quality = maxMode ? .48 : enhance ? .92 : .72;
        const blob = await canvasBlob(canvas, quality);
        const dataUrl = await blobToDataURL(blob);
        const originalPage = await pdf.getPage(p);
        const size = originalPage.getViewport({scale:1});
        if (p > 1) doc.addPage([size.width,size.height]);
        else { doc.deletePage(1); doc.addPage([size.width,size.height]); }
        doc.addImage(dataUrl,"JPEG",0,0,size.width,size.height,undefined,"FAST");
        progress(((attempt + p/pdf.numPages) / dpiList.length) * 90, `Processing PDF page ${p} of ${pdf.numPages}…`);
      }
      const blob = doc.output("blob");
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (enhance || blob.size <= targetBytes) break;
    }
    return bestBlob;
  }
  function blobToDataURL(blob) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  async function processFile() {
    if (!state.file || state.busy) return;
    state.busy = true;
    $("processBtn").disabled = true;
    $("progressWrap").classList.remove("hidden");
    $("progressBar").style.width = "0%";
    resetResult();
    const original = state.file;
    try {
      let blob, message;
      if (state.mode === "reduce") {
        const amount = Number($("targetSize").value);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a target size greater than zero.");
        const target = amount * ($("targetUnit").value === "MB" ? 1024**2 : 1024);
        if (isPdf(original)) {
          const maxMode = $("pdfMode").value === "max";
          blob = await renderPdf(original, {targetBytes:target, maxMode});
          message = blob.size <= target ? "Target size reached." : "Best available browser-side compression was produced; the target size could not be guaranteed.";
          message += " PDF pages are exported as images, so text may no longer be selectable.";
        } else {
          blob = await reduceImage(original, target);
          message = blob.size <= target ? "Target size reached." : "Best possible compression from the available settings. The target could not be reached.";
        }
      } else {
        if (isPdf(original)) {
          blob = await renderPdf(original, {enhance:true});
          message = "PDF pages were rendered at higher resolution with contrast enhancement. Text may no longer be selectable.";
        } else {
          blob = await enhanceImage(original);
          message = "Image enhanced and exported as a high-quality JPEG.";
        }
      }
      if (!blob) throw new Error("No output file was generated.");
      state.resultBlob = blob;
      const ext = isPdf(original) ? ".pdf" : ".jpg";
      state.resultName = original.name.replace(/\.[^.]+$/, "") + (state.mode === "reduce" ? "-squeezed" : "-enhanced") + ext;
      const delta = original.size ? ((blob.size - original.size) / original.size) * 100 : 0;
      $("originalStat").textContent = formatSize(original.size);
      $("newStat").textContent = formatSize(blob.size);
      $("changeStat").textContent = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
      $("resultMessage").textContent = message;
      $("resultPanel").classList.remove("hidden");
      progress(100, "Complete");
      setStatus("Your processed file is ready to download.");
      $("resultPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
    } catch (error) {
      setStatus(error.message || "Something went wrong while processing this file.");
      progress(0, "Could not complete processing");
    } finally {
      state.busy = false;
      $("processBtn").disabled = !state.file;
    }
  }

  $("reduceTab").addEventListener("click", () => setMode("reduce"));
  $("enhanceTab").addEventListener("click", () => setMode("enhance"));
  $("fileInput").addEventListener("change", (e) => chooseFile(e.target.files[0]));
  $("removeFile").addEventListener("click", () => {
    state.file = null; $("fileInput").value = ""; $("fileInfo").classList.add("hidden");
    $("fileTitle").textContent = "Drop your image or PDF here"; $("fileSub").innerHTML = 'or <u>browse files</u> from your device';
    $("processBtn").disabled = true; resetResult(); setStatus("File removed.");
  });
  $("processBtn").addEventListener("click", processFile);
  $("downloadBtn").addEventListener("click", () => {
    if (!state.resultBlob) return;
    const url = URL.createObjectURL(state.resultBlob);
    const a = document.createElement("a"); a.href = url; a.download = state.resultName;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  const drop = $("dropzone");
  ["dragenter","dragover"].forEach(event => drop.addEventListener(event, e => {e.preventDefault();drop.classList.add("dragging");}));
  ["dragleave","drop"].forEach(event => drop.addEventListener(event, e => {e.preventDefault();drop.classList.remove("dragging");}));
  drop.addEventListener("drop", e => chooseFile(e.dataTransfer.files[0]));
})();