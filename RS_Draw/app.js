// global variables
let _rhino3dm = null;
let _model = {
  // saved polylines
  polylines: [],
  // new polyline
  points: null,
  // viewport for canvas
  viewport: null,
};

// wait for the rhino3dm web assembly to load asynchronously
rhino3dm().then(function(m) {
  _rhino3dm = m; // global
  run();
});

// initialize canvas and model
function run() {
  let canvas = getCanvas() //this is a function that is on the helper section
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keyup', onKeyUp);
  _model.points = new _rhino3dm.Point3dList();
  _model.viewport = new _rhino3dm.ViewportInfo();
  _model.viewport.screenPort = [0, 0, canvas.clientWidth, canvas.clientHeight];
  let proportion = canvas.clientWidth / canvas.clientHeight;
  _model.viewport.setFrustum(-30 * proportion,30 * proportion,-30,30,1,1000);
  draw();
}

//naive self-intersection check
function selfIntersecting(){
  let poly = _model.polylines[0];
  for(let i = 0; i < poly.segmentCount; i++){
    const lineA = new _rhino3dm.Line(poly.get(i), poly.get(i+1));
    for(let j = i; j < poly.segmentCount; j++){
      if(j===i){continue;}
      const lineB = new _rhino3dm.Line(poly.get(j), poly.get(j+1));
      let x = _rhino3dm.Intersection.lineLine(lineA, lineB, 0.01, true);
      if(x[0] === true){
        if(x[1] == 0 && x[2] == 1 || x[1] == 1 && x[2] == 0){
          continue;
        }else{
          return true;
        }
      }
    }
  }
  return false;
}

//checks if the polygon is counter clock wise oriented
function isCCW(){
  if( area2D(_model.points, _model.points.count) < 0){
    return false;
  }else{
    return true;
  }
}

//Returns the signed area of a 2D polygon
function area2D(poly, n){
  let area = 0.0;
  let i, j, k;

  if (n < 3) return 0;

  for (i = 1, j = 2, k = 0; i < n; i++, j++, k++) {
      area += poly.get(i)[0] * (poly.get(j)[1] - poly.get(k)[1]);
    }
    area += poly.get(n)[0] * (poly.get(1)[1] - poly.get(n-1)[1]);  // wrap-around term
    return area / 2.0;
}

//handles the continue button
function sendJSON(){
  if(_model.polylines.length<1){
    alert('There is no polygon yet. Hit enter to accept');
    return;
  }else if(selfIntersecting()){
    alert('Your polygon can not interset itself');
    return;
  }else{
    //Works with ShapeDiver JSON components
    var polyJSON = {
      type: "polyline",
      data: polyToJSON()
    }
    ///Only works with Rhino7//////////
    //var poly = _model.polylines[0].toPolylineCurve();
    //var polyJSON = poly.toJSON(poly);
    ///////////////////////////////////
    console.log(JSON.stringify(polyJSON));
    downloadJSON(JSON.stringify(polyJSON), 'polygon.json', 'application/json');
  }
}

//A custom function to create a polyline as a list of points
function polyToJSON(){
  let polylineJSON = {points:[]};
  let poly = _model.polylines[0];

  for(let i = 0; i < poly.count; i++){
    polylineJSON.points.push(poly.get(i));
  }
  return polylineJSON;
}

//function to download the file from the browser
function downloadJSON(content, fileName, contentType){
  var a = document.createElement("a");
  var file = new Blob([content], {type: contentType});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

/* * * * * * * * * * * * * * * *  interaction   * * * * * * * * * * * * * * * */
//What about touch interaction?

// handles mouse down events
// adds a new control point at the location of the mouse
function onMouseDown(event) {
  // get the location of the mouse on the canvas
  let [x,y] = getXY(event);

  // if this is a brand new curve, add the first control point
  if (_model.points.count === 0) {//it adds the new point to the point list
    _model.points.add(x, y, 0);
  }
  // add a new control point that will be saved on the next mouse click
  // (the location of the previous control point is now frozen)
  _model.points.add(x, y, 0);
  draw();
}

// handles mouse move events
// the last control point in the list follows the mouse
function onMouseMove(event) {
  let index = _model.points.count - 1;
  if (index >= 0) {
    let [x,y] = getXY(event);
    _model.points.set(index, [x, y, 0]);
    draw();
  }
}

// handles key up events
function onKeyUp(event) {
  switch (event.key) {

    //Added Backspace key behaviour for removing all the geometry
    case "Backspace":
      if(_model.points.count > 1)
        _model.points.clear();
      if(_model.polylines.length >= 1)
        _model.polylines.length = 0;
      canvas.addEventListener('mousedown', onMouseDown);//allow a new polygon to be drawn
      canvas.addEventListener('mousemove', onMouseMove);
      break;

    //Added Left key to remove points
    case "ArrowLeft":
      if(_model.points.count > 2)
        _model.points.removeAt(_model.points.count - 2);
      break;

    // when the enter key is pressed, save the new polygon
    case "Enter":
      if (_model.points.count < 4) { // 3 pts (min.) + next pt
        alert('Not enough points!');
      } else {
        // remove the last point in the list (a.k.a. next)
        let index = _model.points.count - 1;
        _model.points.removeAt(index);
        let poly = new _rhino3dm.Polyline(index + 1);
        if(isCCW()){ //check if the polyline is CCW
          for (var i = 0; i < index; i++) {
            let [x,y,z] = _model.points.get(i);
            poly.add(x,y,z);
          }
          let [x0, y0, z0] = _model.points.get(0);
          poly.add(x0,y0,z0);//to close the polyline
        }else{// if it is not CCW make it.
          for(var i = index -1; i >= 0; i--){
            let [x,y,z] = _model.points.get(i);
            poly.add(x,y,z);
          }
          let [x0, y0, z0] = _model.points.get(index -1);
          poly.add(x0,y0,z0);
        }
        canvas.removeEventListener('mousedown', onMouseDown);//preveting the user from adding more polygons
        canvas.removeEventListener('mousemove', onMouseMove);
        _model.polylines.push(poly);
      }
      // clear points list
      _model.points.clear();
      break;
  }
  draw();
}

/* * * * * * * * * * * * * * * * *  helpers   * * * * * * * * * * * * * * * * */

// gets the canvas
function getCanvas() {
  return document.getElementById('canvas');
}

// gets the [x, y] location of the mouse in world coordinates
function getXY(evt) {
  let canvas = getCanvas();
  let rect = canvas.getBoundingClientRect();
  let x = evt.clientX - rect.left;
  let y = evt.clientY - rect.top;
  let s2w = _model.viewport.getXform(_rhino3dm.CoordinateSystem.Screen, _rhino3dm.CoordinateSystem.World)
  let world_point = _rhino3dm.Point3d.transform([x,y,0], s2w);
  s2w.delete();
  return [world_point[0],world_point[1]];
}

/* * * * * * * * * * * * * * * * *  drawing   * * * * * * * * * * * * * * * * */

// clears the canvas and draws the model
function draw() {
  // get canvas' 2d context
  let canvas = getCanvas();
  let ctx = canvas.getContext('2d');
  let w2s = _model.viewport.getXform(_rhino3dm.CoordinateSystem.World, _rhino3dm.CoordinateSystem.Screen);

  // clear the canvas
  ctx.beginPath();
  ctx.lineWidth = 0.1;
  ctx.strokeStyle = 'rgb(130,130,130)';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // and draw a grid
  for(let i=0; i<50; i+=1){
    [x,y,_] = _rhino3dm.Point3d.transform([i,-50,0], w2s);
    [x1,y1,_] = _rhino3dm.Point3d.transform([i,50,0], w2s);
    ctx.moveTo(x,y);
    ctx.lineTo(x1,y1);
    [x,y,_] = _rhino3dm.Point3d.transform([-i,-50,0], w2s);
    [x1,y1,_] = _rhino3dm.Point3d.transform([-i,50,0], w2s);
    ctx.moveTo(x,y);
    ctx.lineTo(x1,y1);

    [x,y,_] = _rhino3dm.Point3d.transform([-50, i, 0], w2s);
    [x1,y1,_] = _rhino3dm.Point3d.transform([50, i, 0], w2s);
    ctx.moveTo(x,y);
    ctx.lineTo(x1,y1);
    [x,y,_] = _rhino3dm.Point3d.transform([-50, -i, 0], w2s);
    [x1,y1,_] = _rhino3dm.Point3d.transform([50, -i, 0], w2s);
    ctx.moveTo(x,y);
    ctx.lineTo(x1,y1);
  }
  ctx.stroke();

  //draw the X and Y axis
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgb(150,75,75)';
  [x,y,_] = _rhino3dm.Point3d.transform([0,0,0], w2s);
  [x1,y1,_] = _rhino3dm.Point3d.transform([50,0,0], w2s);
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.lineTo(x1,y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = 'rgb(75,150,75)';
  [x1,y1,_] = _rhino3dm.Point3d.transform([0,50,0], w2s);
  ctx.moveTo(x,y);
  ctx.lineTo(x1,y1);
  ctx.stroke();

  // draw saved polylines
  for(let i =0; i < _model.polylines.length; i++)
    drawPolygon(ctx, _model.polylines[i]);

  // create a temporary curve from the points and draw it
  if (_model.points !== null && _model.points.count > 0) {
    // draw control polygon from the temp curve's control points
    drawControlPolygon(ctx, _model.points);
  }

  w2s.delete();
}

// draw a polygon
function drawPolygon(ctx, points){
  //draw the lines between the points
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'rgba(14, 135, 216, 0.5)';
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();

  //this gets the transformation from world coordinates to screen coordinates
  let w2s = _model.viewport.getXform(_rhino3dm.CoordinateSystem.World, _rhino3dm.CoordinateSystem.Screen)

  for (let i = 0; i < points.count; i++) {
    let world_point = points.get(i); //we get the point in world coordinates from the list
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s); //we transform the world_point to screen coordinates and atribute the value to a variable
    if(0 === i)//if it is the first point in the list move to those coordinates
      ctx.moveTo(screen_point[0], screen_point[1]);//screen point is an array with two values X,Y
    else //else draw a line from the current position to the current screen point
      ctx.lineTo(screen_point[0], screen_point[1]);//moveTo and lineTo take an X and Y coordinate of the end point
  }

  if(points.count > 2){ //if the list has more than two points we automatically close the polygon
    let world_point = points.get(0); //get the first point on the list
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s); //transform it to screen coordinates
    ctx.lineTo(screen_point[0], screen_point[1]); //draw a line from the current position to screen_point (the current position is the last point in the points list)
  }
  ctx.stroke(); //this is a function for painting the path
  ctx.fill();

  //draw the corner points
  ctx.setLineDash([]); //it is best to first set the dash type
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  for (let i = 0; i < points.count; i++) { //as previously we iterate the points
    let world_point = points.get(i);
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s);
    let [x,y,z] = screen_point;
    ctx.fillRect(x-1,y-1, 3, 3); //we create a square around the point with white fill
    ctx.strokeRect(x-2, y-2, 5, 5); //we create a stroke around the white rectangle and point
  }
  w2s.delete(); //we delete the variable
}

// draws a control polygon
function drawControlPolygon(ctx, points) {
  // draw dashed lines between control points
  // A possible improvement would be to only draw the last two edges of the control polygon as dashed...
  ctx.strokeStyle = 'darkgray';
  ctx.setLineDash([]);
  ctx.beginPath();

  let w2s = _model.viewport.getXform(_rhino3dm.CoordinateSystem.World, _rhino3dm.CoordinateSystem.Screen)
  for (let i=0; i<points.count; i++) {
    let world_point = points.get(i);
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s);
    if (0 === i)
      ctx.moveTo(screen_point[0], screen_point[1]);
    else
      ctx.lineTo(screen_point[0], screen_point[1]);
  }
  ctx.stroke();
  ctx.setLineDash([4,4]);
  if( points.count > 2 ){
    let world_point = points.get(0);
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s);
    ctx.lineTo(screen_point[0], screen_point[1]);
  }

  ctx.stroke();

  // draw control points
  ctx.setLineDash([]);
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  for (let i=0; i<points.count; i++) {
    let world_point = points.get(i);
    let screen_point = _rhino3dm.Point3d.transform(world_point, w2s);
    let [x,y,z] = screen_point;
    ctx.fillRect(x-1,y-1, 3, 3);
    ctx.strokeRect(x-2, y-2, 5, 5);
  }
  w2s.delete();
}
