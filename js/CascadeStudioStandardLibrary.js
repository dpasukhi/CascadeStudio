function Box (x, y, z, centered = false) {
  let curBox = new oc.BRepPrimAPI_MakeBox(x, y, z).Shape();
  if (centered) { Translate([-x / 2, -y / 2, -z / 2], curBox); }
  sceneShapes.push(curBox);
  return curBox;
}

function Sphere (radius) {
  let spherePlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, 0), oc.gp.prototype.DZ());
  let curSphere = new oc.BRepPrimAPI_MakeSphere(spherePlane, radius).Shape();
  sceneShapes.push(curSphere);
  return curSphere;
}

function Cylinder (radius, height, centered=false) {
  let cylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, centered ? -height / 2:0), new oc.gp_Dir(0, 0, 1));
  let curCylinder = new oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, height).Shape();
  sceneShapes.push(curCylinder);
  return curCylinder;
}

function Cone(radius1, radius2, height) {
  //console.error("Cone Not Implementable Yet!"); return;
  let curCone = new oc.BRepPrimAPI_MakeCone(radius1, radius2, height).Shape();
  sceneShapes.push(curCone);
  return curCone;
}

function Polygon(points, wire = false) {
  let gpPoints = [];
  for(let ind = 0; ind < points.length; ind++){
    gpPoints.push(new oc.gp_Pnt(points[ind  ][0], points[ind  ][1], points[ind  ][2]));
  }

  let polygonWire = new oc.BRepBuilderAPI_MakeWire();
  for(let ind = 0; ind < points.length-1; ind++){
    let seg  = new oc.GC_MakeSegment(gpPoints[ind], gpPoints[ind+1]).Value();
    let edge = new oc.BRepBuilderAPI_MakeEdge(seg).Edge();
    let innerWire = new oc.BRepBuilderAPI_MakeWire(edge).Wire();
    polygonWire.Add(innerWire);
  }
  let seg2  = new oc.GC_MakeSegment(gpPoints[points.length-1], gpPoints[0]).Value();
  let edge2 = new oc.BRepBuilderAPI_MakeEdge(seg2).Edge();
  let innerWire2 = new oc.BRepBuilderAPI_MakeWire(edge2).Wire();
  polygonWire.Add(innerWire2);
  let finalWire = polygonWire.Wire();

  if (wire) { sceneShapes.push(finalWire); return finalWire; }

  let polygon = new oc.BRepBuilderAPI_MakeFace(polygonWire.Wire(), true).Face();
  sceneShapes.push(polygon);
  return polygon;
}

function BSpline(inPoints, closed = false){
  let ptList = new oc.TColgp_Array1OfPnt(1, inPoints.length + (closed?1:0));
  for(let pIndex = 1; pIndex <= inPoints.length; pIndex++){
      ptList.SetValue(pIndex, new oc.gp_Pnt(
          inPoints[pIndex-1][0], 
          inPoints[pIndex-1][1], 
          inPoints[pIndex-1][2]));
  }
  if (closed) { ptList.SetValue(inPoints.length + 1, ptList.Value(1)); }
  return new oc.GeomAPI_PointsToBSpline(ptList).Curve();
}

function Text3D(text = "Hello!", size = 36, height = 0.15, fontURL = curFontURL) {
  if (fontURL !== curFontURL) {
    curFontURL = fontURL;
    opentype.load(curFontURL, function (err, font) {
      if (err) { console.log(err); }
      robotoFont = font;
      console.log("New Font Loaded!  Please refresh your model to see changes...")
    });
  }

  if (robotoFont === undefined) { console.log("Font not loaded yet!  Try again..."); return; }
  let textFaces = [];
  let commands = robotoFont.getPath(text, 0, 0, size).commands;
  for(let idx = 0; idx < commands.length; idx++) {
      if (commands[idx].type === "M") {
          // Start a new Glyph
          //console.log(commands[idx]);
          var firstPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
          //let derp = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
          var lastPoint = firstPoint;
          var currentWire = new oc.BRepBuilderAPI_MakeWire();
      } else if(commands[idx].type === "Z"){
          // End the current Glyph and Finish the Path
          //console.log(commands[idx]);

          let faceBuilder = null;
          if(textFaces.length > 0){
              faceBuilder = new oc.BRepBuilderAPI_MakeFace(
                  textFaces[textFaces.length-1], currentWire.Wire());
              //console.log(faceBuilder.Error()); // This always succeeds D:
          }else{
              faceBuilder = new oc.BRepBuilderAPI_MakeFace(currentWire.Wire());
          }

          textFaces.push(faceBuilder.Face());
      } else if(commands[idx].type === "L") {
          //console.log(commands[idx]);
          let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
          if(lastPoint.X() === nextPoint.X() && lastPoint.Y() === nextPoint.Y()){ continue; }
          let lineSegment = new oc.GC_MakeSegment(lastPoint, nextPoint).Value();
          let lineEdge    = new oc.BRepBuilderAPI_MakeEdge(lineSegment).Edge();
          currentWire.Add(  new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
          lastPoint = nextPoint;
      } else if(commands[idx].type === "Q") {
          //console.log(commands[idx]);
          let controlPoint = new oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
          let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

          let ptList = new oc.TColgp_Array1OfPnt(1, 3);
          ptList.SetValue(1, lastPoint);
          ptList.SetValue(2, controlPoint);
          ptList.SetValue(3, nextPoint);
          let quadraticCurve = new oc.Geom_BezierCurve(ptList);
          let lineEdge    = new oc.BRepBuilderAPI_MakeEdge(new oc.Handle_Geom_BezierCurve(quadraticCurve)).Edge();
          currentWire.Add(  new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());

          lastPoint = nextPoint;
      } else if(commands[idx].type === "C") {
          //console.log(commands[idx]);
          let controlPoint1 = new oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
          let controlPoint2 = new oc.gp_Pnt(commands[idx].x2, commands[idx].y2, 0);
          let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

          let ptList = new oc.TColgp_Array1OfPnt(1, 4);
          ptList.SetValue(1, lastPoint);
          ptList.SetValue(2, controlPoint1);
          ptList.SetValue(3, controlPoint2);
          ptList.SetValue(4, nextPoint);
          let cubicCurve  = new oc.Geom_BezierCurve(ptList);
          let lineEdge    = new oc.BRepBuilderAPI_MakeEdge(new oc.Handle_Geom_BezierCurve(cubicCurve)).Edge();
          currentWire.Add(  new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
          
          lastPoint = nextPoint;
      }
  }

  return Rotate([1, 0,0], -90, Extrude(textFaces[textFaces.length-1], [0,0,height * size]));
}

function ForEachShell(shape, callback) {
  let shell_index = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_SHELL);
  for (anExplorer.Init(shape, oc.TopAbs_SHELL); anExplorer.More(); anExplorer.Next()) {
    callback(shell_index++, oc.TopoDS.prototype.Face(anExplorer.Current()));
  }
}

function ForEachFace(shape, callback) {
  let face_index = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_FACE);
  for (anExplorer.Init(shape, oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
    callback(face_index++, oc.TopoDS.prototype.Face(anExplorer.Current()));
  }
}

function ForEachWire(shape, callback) {
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_WIRE);
  for (anExplorer.Init(shape, oc.TopAbs_WIRE); anExplorer.More(); anExplorer.Next()) {
    callback(oc.TopoDS.prototype.Wire(anExplorer.Current()));
  }
}

function ForEachEdge(shape, callback) {
  let edgeHashes = {};
  let edgeIndex = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_EDGE);
  for (anExplorer.Init(shape, oc.TopAbs_EDGE); anExplorer.More(); anExplorer.Next()) {
    let edge = oc.TopoDS.prototype.Edge(anExplorer.Current());
    let edgeHash = edge.HashCode(100000000);
    if(!edgeHashes.hasOwnProperty(edgeHash)){
      edgeHashes[edgeHash] = edgeIndex;
      callback(edgeIndex++, edge);
    }
  }
  return edgeHashes;
}

function ForEachVertex(shape, callback) {
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_VERTEX);
  for (anExplorer.Init(shape, oc.TopAbs_VERTEX); anExplorer.More(); anExplorer.Next()) {
    callback(oc.TopoDS.prototype.Vertex(anExplorer.Current()));
  }
}

function FilletEdges(shape, radius, edgeSelector = (index, edge) => true) { 
  let mkFillet = new oc.BRepFilletAPI_MakeFillet(shape);
  ForEachEdge(shape, (index, edge) => {
    if (edgeSelector(index, edge)) { mkFillet.Add(radius, edge); }
  });
  sceneShapes.push(mkFillet.Shape());
  sceneShapes = Remove(sceneShapes, shape);
}

function Translate(offset = [0, 0, 0], shapes) {
  let transformation = new oc.gp_Trsf();
  transformation.SetTranslation(new oc.gp_Vec(offset[0], offset[1], offset[2]));
  let translation = new oc.TopLoc_Location(transformation);
  if (!isArrayLike(shapes)) {
    shapes.Move(translation);
  } else if (shapes.length === 1) {
    for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++){
      shapes[shapeIndex].Move(translation);
    }
  }
  return shapes;
}

function Rotate(axis = [0, 1, 0], degrees = 0, shapes) {
  let transformation = new oc.gp_Trsf();
  transformation.SetRotation(
    new oc.gp_Ax1(new oc.gp_Pnt(0, 0, 0), new oc.gp_Dir(
      new oc.gp_Vec(axis[0], axis[1], axis[2]))), degrees*0.0174533);
  let rotation = new oc.TopLoc_Location(transformation);
  if (!isArrayLike(shapes)) {
    shapes.Move(rotation);
  } else if (shapes.length === 1) {      // Do the normal rotation
    for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++){
      shapes[shapeIndex].Move(rotation);
    }
  }
  return shapes;
}

function Scale(scale = 1, shapes) {
  let transformation = new oc.gp_Trsf();
  transformation.SetScaleFactor(scale);
  let scaleTrans = new oc.TopLoc_Location(transformation);
  if (!isArrayLike(shapes)) {
    shapes.Move(scaleTrans);
  } else if (shapes.length === 1) {      // Do the normal scaling
    for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++){
      shapes[shapeIndex].Move(scaleTrans);
    }
  }
  return shapes;
}

function Union(objectsToJoin = [], keepObjects = false) {
  let combined = objectsToJoin[0];
  if (objectsToJoin.length > 1) {
    for (let i = 0; i < objectsToJoin.length; i++) {
      if (i > 0) { combined = new oc.BRepAlgoAPI_Fuse(combined, objectsToJoin[i]).Shape(); }
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToJoin[i]); }
    }
  }
  sceneShapes.push(combined);
  return combined;
}

function Difference(mainBody, objectsToSubtract = [], keepObjects = false) {
  let difference = mainBody;
  if (!keepObjects) { sceneShapes = Remove(sceneShapes, mainBody); }
  if (objectsToSubtract.length >= 1) {
    for (let i = 0; i < objectsToSubtract.length; i++) {
      difference = new oc.BRepAlgoAPI_Cut(difference, objectsToSubtract[i]).Shape();
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToSubtract[i]); }
    }
  }
  sceneShapes.push(difference);
  return difference;
}

function Intersection(objectsToIntersect = [], keepObjects = false) {
  let intersected = objectsToIntersect[0];
  if (objectsToIntersect.length > 1) {
    for (let i = 0; i < objectsToIntersect.length; i++) {
      if (i > 0) { intersected = new oc.BRepAlgoAPI_Common(intersected, objectsToIntersect[i]).Shape(); }
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToIntersect[i]); }
    }
  }
  sceneShapes.push(intersected);
  return intersected;
}

function Extrude(face, direction, keepFace = false) {
  if (face.ShapeType() !== 4) {
    throw new Error("Extrude was expecting a Face (Type Number 4)!  Was Type Number: " + face.ShapeType());
  }
  let extruded = new oc.BRepPrimAPI_MakePrism(face,
    new oc.gp_Vec(direction[0], direction[1], direction[2])).Shape();
  if (!keepFace) { sceneShapes = Remove(sceneShapes, face); }
  sceneShapes.push(extruded);
  return extruded;
}

function Slider(name = "Val", defaultValue = 0.5, min = 0.0, max = 1.0, realTime=false, callback = monacoEditor.evaluateCode) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  GUIState[name + "Range"] = [min, max];
  guiPanel.addSlider(GUIState, name, name + 'Range', { onFinish: () => { callback(); }, onChange: () => { if (realTime) { callback(); } } });
  return GUIState[name];
}

function Button(name = "Action", callback = monacoEditor.evaluateCode) {
  guiPanel.addButton(name, () => { callback(); });
}

function Checkbox(name = "Toggle", defaultValue = false, callback = monacoEditor.evaluateCode) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  guiPanel.addCheckbox(GUIState, name, { onChange: () => { callback(); } });
  return GUIState[name];
}

// Random Javascript Utilities
function Remove(inputArray, objectToRemove) {
  return inputArray.filter((el) => { return el !== objectToRemove; });
}

function isArrayLike(item) {
  return (
      Array.isArray(item) || 
      (!!item &&
        typeof item === "object" &&
        item.hasOwnProperty("length") && 
        typeof item.length === "number" && 
        item.length > 0 && 
        (item.length - 1) in item
      )
  );
}