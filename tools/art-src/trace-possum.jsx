// Trace the five Productive Possum colour layers in Adobe Illustrator.
#target illustrator
(function () {
  var dir = '/Users/janeytietz/Desktop/pomocat/tools/art-src/possum-layers/';
  var names = ['static', 'head', 'writing-arm', 'resting-arm', 'tail'];
  var log = new File('/Users/janeytietz/Desktop/pomocat/tools/art-src/possum-trace.log');
  log.open('w');
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  for (var i = 0; i < names.length; i++) {
    var doc = app.documents.add(DocumentColorSpace.RGB, 1024, 1024);
    try {
      var placed = doc.placedItems.add();
      placed.file = new File(dir + names[i] + '.png');
      placed.position = [0, 1024];
      placed.width = 1024;
      placed.height = 1024;

      var item = placed.trace();
      var o = item.tracing.tracingOptions;
      o.tracingMode = TracingModeType.TRACINGMODECOLOR;
      o.tracingColorTypeValue = TracingColorType.TRACINGLIMITEDCOLOR;
      o.maxColors = 16;
      o.pathFidelity = 72;
      o.cornerFidelity = 76;
      o.noiseFidelity = 8;
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
      log.writeln('ok ' + names[i]);
    } catch (e) {
      log.writeln('error ' + names[i] + ': ' + e + ' line ' + e.line);
    }
    doc.close(SaveOptions.DONOTSAVECHANGES);
  }
  log.close();
})();
