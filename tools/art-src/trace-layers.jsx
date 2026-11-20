// Traces the paint and ink layers from layers.py with Illustrator's Image Trace.
// Paint: smooth colour shapes. Ink: crisp black linework at high fidelity.
// Run: osascript -e 'tell application "/Applications/Adobe Illustrator 2027/Adobe Illustrator.app" to do javascript file "<this file>"'
#target illustrator
(function () {
  // Which layer folders to trace: one name per line in trace-dirs.txt (default: layers).
  var root = '/Users/janeytietz/Desktop/pomocat/tools/art-src/';
  var dirs = ['layers'];
  var list = new File(root + 'trace-dirs.txt');
  if (list.exists) {
    list.open('r');
    dirs = [];
    while (!list.eof) { var line = list.readln().replace(/^\s+|\s+$/g, ''); if (line) dirs.push(line); }
    list.close();
  }
  var dir;
  var parts = ['static', 'head', 'arm', 'tail'];
  // A folder can list its own parts in parts.txt (the possum has two arms).
  function partsFor(d) {
    var f = new File(d + 'parts.txt');
    if (!f.exists) return parts;
    f.open('r'); var out = [];
    while (!f.eof) { var l = f.readln().replace(/^\s+|\s+$/g, ''); if (l) out.push(l); }
    f.close(); return out;
  }
  var log = new File(root + 'trace.log');
  log.open('w');
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  function traceOne(name, layer) {
    var doc = app.documents.add(DocumentColorSpace.RGB, 1024, 1024);
    try {
      var placed = doc.placedItems.add();
      placed.file = new File(dir + layer + '-' + name + '.png');
      placed.position = [0, 1024];
      placed.width = 1024;
      placed.height = 1024;
      var item = placed.trace();
      var o = item.tracing.tracingOptions;
      if (layer === 'ink') {
        o.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
        o.threshold = 128;
        o.pathFidelity = 88;
        o.cornerFidelity = 90;
        o.noiseFidelity = 3;
      } else {
        o.tracingMode = TracingModeType.TRACINGMODECOLOR;
        o.tracingColorTypeValue = TracingColorType.TRACINGLIMITEDCOLOR;
        o.maxColors = 24;
        o.pathFidelity = 55;
        o.cornerFidelity = 40;
        o.noiseFidelity = 14;
      }
      o.ignoreWhite = true;
      o.tracingMethod = TracingMethodType.TRACINGMETHODABUTTING;
      o.fills = true;
      o.strokes = false;
      app.redraw();
      item.tracing.expandTracing();
      var opts = new ExportOptionsSVG();
      opts.embedRasterImages = false;
      opts.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
      opts.coordinatePrecision = 2;
      doc.exportFile(new File(dir + layer + '-' + name + '.svg'), ExportType.SVG, opts);
      log.writeln('ok ' + dir + layer + '-' + name);
    } catch (e) {
      log.writeln('error ' + layer + '-' + name + ': ' + e + ' line ' + e.line);
    }
    doc.close(SaveOptions.DONOTSAVECHANGES);
  }

  for (var d = 0; d < dirs.length; d++) {
    dir = root + dirs[d] + '/';
    var these = partsFor(dir);
    for (var i = 0; i < these.length; i++) {
      traceOne(these[i], 'paint');
      traceOne(these[i], 'ink');
    }
  }
  log.close();
})();
