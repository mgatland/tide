
//following http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/

// Constants:
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
var pixelSize = 16;
var width = 32;
var height = width;
var normalTimeToGrowBadness = 120; //number of frames it takes for badness to capture a cell.
var explosionRadius = 7;
var maxHealth = 120; //frames it takes to die when standing in goop
var maxExpansionAge = 90; //frames that an expansion keeps goop from returning

//colors: http://colorschemedesigner.com/#5631Tw0w0w0w0
var wallColor = "#A00068";
var backgroundColor = "#800053";
var burnedBackgroundColor = "#571C43";

var playerColor = "#B4FFA3";

var badnessColor = "#4281FF";
var badnessOverSpace = "#5559C9";
var badnessOverWalls = "#996DFF";
var badnessFlashColor = badnessOverWalls;

var mineColor = "#FFCC02";

var levelColor = wallColor;
var oldLevelColor = burnedBackgroundColor;

var transitionWinTime = 90;
var transitionLoseTime = 160;

var optionKeyDelay = 45;

canvas.width = width*pixelSize;
canvas.height = (height+6)*pixelSize;
document.getElementById('gameframe').appendChild(canvas);

//to integer	
var toInt = function (value) { return ~~value; }


var rnd = function (range) {
	return Math.floor(Math.random()*range);
}

if (typeof KeyEvent == "undefined") {
    var KeyEvent = {
        DOM_VK_RETURN: 13,
        DOM_VK_ENTER: 14,
        DOM_VK_SPACE: 32,
        DOM_VK_LEFT: 37,
        DOM_VK_UP: 38,
        DOM_VK_RIGHT: 39,
        DOM_VK_DOWN: 40,
        DOM_VK_M: 77
    }
}

// persisted state:
var highestLevel = 0;

// game state:
var expansions; //a list of mine expanders {pos {x, y}, age }
var player;
var numMines;
var world;
var mines;
var level;
var transition;

var optionKeyTimer = 0;

var createGrid = function () {
	var gridData = [];
	for (var i = 0; i < width; i ++) {
		gridData[i] = [];
		for (var j = 0; j < height; j++) {
			gridData[i][j] = 0;
		}
	}

	var grid = {};

	grid.isValid = function (x, y) {
		if (x < 0 || x >= width) {
			return false;
		}
		if (y < 0 || y >= height) {
			return false;	
		}
		return true;
	}

	grid.get = function (x, y) {
		if (!this.isValid(x, y)) {
			return 0;
		}
		return gridData[x][y]; 
	}; 

	grid.set = function (x, y, value) {
		if (!this.isValid(x, y)) {
			return;
		}
		gridData[x][y] = value;
	}


	return grid;
}

var newLevel = function() {

	if (level > highestLevel) {
		highestLevel = level;
	}

	expansions = [];
	player = {pos: {}};
	numMines = level + 2;
	world = {};
	mines = [];
	player.pos.x = toInt(width / 2);
	player.pos.y = toInt(height / 2);
	player.moveDelay = 5;
	player.moveTimer = 0;
	player.health = maxHealth;

	world.wall = createGrid();
	world.badness = createGrid();

	transition = null;

	forEachCell(world.wall, function(grid, x, y) {
		if (rnd(10) > 7) {
			grid.set(x, y, 1);
		}
	});

	//create mines

	for (var i = 0; i < numMines; i++) {
		var x = -1;
		var y = -1;
		while(x === -1) {
			var x = rnd(width);
			var y = rnd(height);
			if (world.wall.get(x, y) != 1 && mineAt(x, y) === null) {
				var mine = { pos: {}};
				mine.pos.x = x;
				mine.pos.y = y;
				mines.push(mine);
			} else {
				x = -1; //loop again
			}
		}	
	}
}

var forEachCell = function(thing, func) {
	for (var i = 0; i < width; i ++) {
		for (var j = 0; j < height; j++) {
			func(thing, i, j);
		}
	}
}

var mineAt = function (x, y) {
	var foundMine = null;
	mines.forEach(function (mine) {
		if (mine.pos.x === x && mine.pos.y === y) {
			foundMine = mine;
		}
	});
	return foundMine;
}

level = 1;
newLevel();

// Handle keyboard controls
var keysDown = {};

addEventListener("keydown", function (e) {
	keysDown[e.keyCode] = true;
}, false);

addEventListener("keyup", function (e) {
	delete keysDown[e.keyCode];
}, false);

var drawPixel = function (x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
}

// Draw everything
var render = function () {
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0,0, width*pixelSize, height*pixelSize);
	
	forEachCell(world, function (world, x, y) {
		if (world.badness.get(x, y) >= maxBadnessAt(x, y)) {
			var color = badnessColor;
			if (toInt(player.flashing / 4) % 2 != 0) {
				color = badnessFlashColor;
			}
			drawPixel(x, y, color);
		} else if (world.badness.get(x, y) > 0) {
			if (isSpace(x, y)) {
				drawPixel(x, y, badnessOverSpace);
			} else {
				drawPixel(x, y, badnessOverWalls);
			}
		} else if (world.wall.get(x, y) > 0) {
			drawPixel(x, y, wallColor);
		} else if (world.wall.get(x, y) == -1) {
			drawPixel(x, y, burnedBackgroundColor);
		}
	});

	mines.forEach(function (mine) {
		drawPixel(mine.pos.x, mine.pos.y, mineColor);
	});

	drawPlayer();

	drawTransition();

	drawBar(1, player.health, maxHealth, playerColor, burnedBackgroundColor);

	ctx.fillStyle = "#000";
	ctx.fillRect(0,(height+3)*pixelSize, width*pixelSize, 3*pixelSize);
	drawDots(3, highestLevel, oldLevelColor);
	drawDots(3, level, levelColor);

};

var drawPlayer = function() {
	if (player.hidden) {
		return;
	}
	drawPixel(player.pos.x, player.pos.y, playerColor);
}

var forEveryCellInTeleportAnimation = function(pos, frame, func) {
	for (var j = -1; j <= 1; j++) {
		var xOffset = frame;
		xOffset -= Math.abs(j);
		var width = Math.min(3, xOffset+1);
		for (var i = 0; i < width; i++) {
			func(pos.x - xOffset + i, pos.y + j);
			func(pos.x + xOffset - i, pos.y + j);		
		}
	}
}

var drawTransition = function() {
	if (transition == null) {
		return;
	}
	if (transition.age < 7) {
		return;
	}
	if (transition.win === false) {
		return;
	}
	if (transition.age == 7) {
		player.hidden = true;
		transition.pos = player.pos;	
	}
	forEveryCellInTeleportAnimation(transition.pos, transition.age - 7, function(x, y) {
		if (world.wall.isValid(x, y)) {
			drawPixel(x, y, playerColor);	
		}
	});
}

var drawDots = function(row, value, foreColor, backColor) {
	ctx.fillStyle = foreColor;
	for (var n = 0; n < value; n++) {
		ctx.fillRect(n*2*pixelSize, (height+row)*pixelSize, pixelSize, pixelSize);
	}
	if (value * 2 > width) {
		//draw another row
		for (var n = 0; n < value - toInt(width/2); n++) {
				ctx.fillRect((1+n*2)*pixelSize, (height+row+1)*pixelSize, pixelSize, pixelSize);
		}
	}

	if (value * 3 > width) {
		//draw another row
		for (var n = 0; n < value - toInt(width); n++) {
				ctx.fillRect((n*2)*pixelSize, (height+row+2)*pixelSize, pixelSize, pixelSize);
		}
	}
}

var drawBar = function(row, current, max, foreColor, backColor) {
	ctx.fillStyle = backColor;
	ctx.fillRect(0,(height+row)*pixelSize, width*pixelSize, 1*pixelSize);
	ctx.fillStyle = foreColor;
	ctx.fillRect(0,(height+row)*pixelSize, toInt(current*width/max)*pixelSize, 1*pixelSize);
}

var updateOptionKeys = function () {
	if (optionKeyTimer > 0) {
		optionKeyTimer--;
	}
	if (optionKeyTimer == 0) {
		if (keysDown[KeyEvent.DOM_VK_M] === true) {
			optionKeyTimer = optionKeyDelay;
			soundUtil.toggleMute();
		}
	}
}

// The main game loop
var main = function () {
	update();
	render();
};

var update = function () {
	updatePlayer();
	updateBadness();
	updateExpansions();

	//updateTransition
	if (transition != null) {
		transition.age++;
		if (transition.age == transition.duration) {
			if (transition.win === true) {
				level++;
			} else {
				level = 1;
			}
			newLevel();	
		}
	}
	//updateWinOrLoseCondition
	if (mines.length == 0 && transition == null) {
		transition = {};
		transition.age = 0;
		transition.win = true;
		transition.duration = transitionWinTime;
		soundUtil.playWinSound();
	}
	if (player.health === 0 && transition == null) {
		transition = {};
		transition.age = 0;
		transition.win = false;
		transition.duration = transitionLoseTime;
	}

	//update music toggle
	updateOptionKeys();
}

var removeFromArray = function(element, array) {
	var index = array.indexOf(element);
	array.splice(index, 1);
}

var spreadBadnessInto = function(badness, pos) {
	var currentBadness = badness.get(pos.x, pos.y);
	if (currentBadness == 0) {
		badness.set(pos.x, pos.y, 1 + rnd(normalTimeToGrowBadness / 2));
	}
}

var isSpace = function(x, y) {
	return (world.wall.get(x, y) <= 0);
}

var maxBadnessAt = function(x, y) {
	if (isSpace(x, y)) {
		return normalTimeToGrowBadness;
	}
	return normalTimeToGrowBadness * 5;
}

var updateBadness = function() {
	forEachCell(world.badness, function (badness, x, y) {
		var currentBadness = badness.get(x,y);

		if (currentBadness > 0) {
			if (currentBadness < maxBadnessAt(x, y)) {
				badness.set(x, y, currentBadness + 1);
			} else {
				var above = {x: x, y: y - 1};
				var below = {x: x, y: y + 1};
				var left = {x: x - 1, y: y};
				var right = {x: x + 1, y: y};
				spreadBadnessInto(badness, above);
				spreadBadnessInto(badness, below);
				spreadBadnessInto(badness, left);
				spreadBadnessInto(badness, right);
			}
		}

		//hack to get the badness started
		if (y === height - 1 || y === 0) {
			spreadBadnessInto(badness, {x: x, y:y});
		}
	})
}



var triggerExpansion = function (pos) {
	//clear goop and walls from expansion area
	forEveryCellInDiamond(pos, explosionRadius, function(x, y) {
		world.badness.set(x,y,0);
		world.wall.set(x, y, -1);
	});
	world.wall.set(pos.x, pos.y, 0); //just to make the centre look different
	var expansion = { pos: pos, age: 0};
	expansions.push(expansion);
	soundUtil.playExplodeSound();
}

var forEveryCellInDiamond = function (pos, bigRadius, func) {
	var smallRadius = Math.ceil(bigRadius / 2);
	for (var x = pos.x - smallRadius; x <= pos.x + smallRadius; x++) {
		var span = bigRadius - Math.abs(x - pos.x) * 2;
		for (var y = pos.y - span; y <= pos.y + span; y++) {
			func(x, y);
		}
	}
}

var updateExpansions = function() {
	expansions.forEach(function (expansion) {
		expansion.age++;
		var pos = expansion.pos;

		//clear goop - this is a bit weird, we could've put this logic in the goop spread code
		//todo: duplicate code
		forEveryCellInDiamond(expansion.pos, explosionRadius, function(x, y) {
			world.badness.set(x,y,0);
		});
		if (expansion.age == maxExpansionAge) {
			removeFromArray(expansion, expansions);
		}
	});
}

var updatePlayer = function() {

	if (player.health === 0) {
		return;
	}
	if (player.hidden) {
		player.flashing = 0;
		soundUtil.stopBuzz();
		return;
	}
	if (player.moveTimer == 0) {
		var newPos = {};
		newPos.x = player.pos.x;
		newPos.y = player.pos.y;
		if (keysDown[KeyEvent.DOM_VK_LEFT] === true) {
			newPos.x--;
		} else if (keysDown[KeyEvent.DOM_VK_RIGHT] === true) {
			newPos.x++;
		} else if (keysDown[KeyEvent.DOM_VK_UP] === true) {
			newPos.y--;
		} else if (keysDown[KeyEvent.DOM_VK_DOWN] === true) {
			newPos.y++;
		} else {
			newPos = null;
		}	

		if (newPos != null) {
			if (world.wall.isValid(newPos.x, newPos.y)) {
				player.pos = newPos;
				player.moveTimer = player.moveDelay;
				//did we step on a mine?
				var mine = mineAt(newPos.x, newPos.y);
				if (mine != null) {
					removeFromArray(mine, mines);
					triggerExpansion(mine.pos);
				}
			}
		}
	} else {
		player.moveTimer--;
	}
	if (world.badness.get(player.pos.x, player.pos.y) > 0) {
		player.health--;
		if (player.health <= 0) {
			player.health = 0;
			player.flashing = 0;
			soundUtil.stopBuzz();
			player.hidden = true;
			triggerExpansion(player.pos);
		} else {
			player.flashing++;
			soundUtil.playBuzz();
		}
	} else {
		player.flashing = 0;
		soundUtil.stopBuzz();
	}
}

var SoundUtil = function() {
	var audioContext;
	var explodeSound;
	var buzzSound;
	var winSound;
	var audioEnabled = true;
	var muted = false;
	var music;

	var audio = new Audio();
	var mp3Support = audio.canPlayType("audio/mpeg");
	var oggSupport = audio.canPlayType("audio/ogg");
	var extension;

	if(mp3Support == "probably" || mp3Support == "maybe") {
		extension = ".mp3";
	} else if(oggSupport == "probably" || oggSupport == "maybe") {
		extension = ".ogg";
	} else {
		console.log("I don't think this browser can play our music.");
		return;
	}

	music = new Audio("music/DJ DOS - LOOP (Creative Commons Attribution-Share Alike 3.0)" + extension); 
	explodeSound = new Audio("sounds/thump" + extension);
	buzzSound = new Audio("sounds/buzz" + extension);
	winSound = new Audio("sounds/win" + extension);
	music.loop = true;

	function play(sound) {
		if (muted) {
			return;
		}
		if (sound.duration > 0 && !sound.paused) {
			sound.pause();
			sound.currentTime = 0;
		}
		sound.play();
	}

	this.playExplodeSound = function() {
		play(explodeSound);
	}

	this.playWinSound = function() {
		play(winSound);
	}

	this.playBuzz = function() {
		if (muted) {
			return;
		}
		if (buzzSound.duration > 0 && !buzzSound.paused) {
			//ignore, already playing
		} else {
			buzzSound.play();
		}
	}

	this.stopBuzz = function() {
		if (buzzSound.duration > 0 && !buzzSound.paused) {
			buzzSound.pause();
			buzzSound.currentTime = 0;
		}
	}

	this.playMusic = function() {
		music.play();
	}

	this.toggleMute = function() {
		if (muted) {
			muted = false;
			music.play();			
		} else {
			muted = true;
			music.pause();
			this.stopBuzz();
		}
	}
}

var soundUtil = new SoundUtil();
soundUtil.playMusic();
setInterval(main, 1000 / 60);