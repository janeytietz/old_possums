#target illustrator
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
var files = ["/Users/janeytietz/Desktop/pomocat/tools/express/background-1-manuscript-page.svg","/Users/janeytietz/Desktop/pomocat/tools/express/background-2-bestiary-panel.svg","/Users/janeytietz/Desktop/pomocat/tools/express/background-3-woodcut-print.svg","/Users/janeytietz/Desktop/pomocat/tools/express/background-4-church-wall.svg"];
for (var i = 0; i < files.length; i++) { app.open(new File(files[i])); }
app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
