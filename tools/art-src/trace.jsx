// Traces each flat part PNG in tools/art-src/parts/ into an SVG with Illustrator's Image Trace.
// Run: osascript -e 'tell application "/Applications/Adobe Illustrator 2027/Adobe Illustrator.app" to do javascript file "<this file>"'
#target illustrator
(function () {
  var dir = '/Users/janeytietz/Desktop/pomocat/tools/art-src/parts/';
  var names = ['static', 'head', 'arm', 'tail'];
  var log = new File('/Users/janeytietz/Desktop/pomocat/tools/art-src/trace.log');
  log.open('w');
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  for (var i = 0; i < names.length; i++) {
    try {
      var doc = app.documents.add(DocumentColorSpace.RGB, 1024, 1024);
      var placed = doc.placedItems.add();
      placed.file = new File(dir + names[i] + '.png');
      placed.position = [0, 1024];
      placed.width = 1024;
      placed.height = 1024;

      var item = placed.trace();
      var o = item.tracing.tracingOptions;
      o.tracingMode = TracingModeType.TRACINGMODECOLOR;
      o.tracingColorTypeValue = TracingColorType.TRACINGLIMITEDCOLOR;
      o.maxColors = 10;
      o.pathFidelity = 70;
      o.cornerFidelity = 75;
      o.noiseFidelity = 10;
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
      doc.exportFile(new File(dir + names[i] + '.svg'), ExportType.SVG, opts);
      doc.close(SaveOptions.DONOTSAVECHANGES);
      log.writeln('ok ' + names[i]);
    } catch (e) {
      log.writeln('error ' + names[i] + ': ' + e + ' line ' + e.line);
    }
  }
  log.close();
})();
