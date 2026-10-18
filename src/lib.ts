/** A board location in `[x, y]` format, where `[0, 0]` is the top-left corner. */
export type Coord = [number, number];

/** A CSS colour string. */
export type CSSColour = string;

/** The information to render on the board, including stones, markup, and annotations. */
export interface BoardContents
{
	/** The number of lines wide the board is. */
	width: number;

	/** The number of lines tall the board is. */
	height: number;

	/** The list of stones on the board. Stones can have any colour, but typically will be "black" or "white". */
	stones: [Coord, CSSColour][];

	/** The location of the most recent move. */
	lastMove?: Coord;

	/** The annotation for the most recent move. */
	lastMoveType?: "brilliant" | "excellent" | "good" | "mistake" | "blunder";

	/** The location and colour of the next move. */
	nextMove?: [Coord, CSSColour];

	/** Labeled points on the board. */
	labels?: [Coord, string][];

	/** Markup lines on the board. */
	lines?: [Coord, Coord][];

	/** Markup arrows on the board. The arrowhead is drawn at the second location in the pair. */
	arrows?: [Coord, Coord][];

	/** The policy vector, in row-major order. */
	policy?: number[];

	/** The policy quality vector, in row-major order. -1 is red and 1 is blue. */
	policyQuality?: number[];

	/** The ownership vector, in row-major order. -1 is black, 1 is white. */
	ownership?: number[];

	/** The list of potential moves and their statistics. */
	moves?: AnalysisMove[];

	/** The cursor overlay location and colour. */
	cursor?: [Coord, CSSColour];
}

/** The statistics of a potential move. */
export interface AnalysisMove
{
	/** The location of the move. */
	move: Coord;

	/** The ranking of the move, where 0 is the best move. */
	order: number;

	/** The number of visits this move has received. */
	visits: number;

	/** The winrate of the move. */
	winrate: number;

	/** The score of the move. */
	scoreLead: number;

	/** The relative weight that the engine gives this move. Determines the colour of the rendered highlight. */
	playSelectionValue: number;
}

/** Styling information for rendering the board. */
export interface BoardStyle
{
	/** The colour of the board. */
	backgroundColour: CSSColour;

	/** The secondary colour of the board, used for the wood grain. */
	woodColour: CSSColour | null;

	/**
	 * The size of the wood grain in pixels.
	 * @default 2
	 */
	woodScale: number;

	/** The colour of the lines. */
	lineColour: CSSColour;

	/**
	 * The locations of the star points, or `"auto"`.
	 * @default "auto"
	 */
	starPoints: Coord[] | "auto";

	/**
	 * The padding at the edge of the board, in stone diameters.
	 * @default 0
	 */
	padding: number;

	/**
	 * The coordinate system used for labels. `"A1"` puts letters from left to right and numbers from bottom to top.
	 * `"kanji"` puts numbers from left to right and kanji numbers from top to bottom.
	 * @default "A1"
	 */
	coords: "A1" | "kanji";

	/**
	 * Which sides of the board to display coordinates on.
	 * @default "all"
	 */
	coordsLocation: "all" | "none" | "top-left" | "bottom-left" | "top-right" | "bottom-right";

	/**
	 * The font family used for rendering text on the board.
	 * @default "Arial, Helvetica, sans-serif"
	 */
	fontFamily: string;

	/**
	 * The minimum threshold for displaying move statistics, in the range [0, 1]. Moves with a `playSelectionValue`
	 * below the best move's `playSelectionValue` raised to this power will not display statistics.
	 */
	moveStatsThreshold: number;
}

const defaultStyle: BoardStyle = {
	backgroundColour: "#e6ba73",
	woodColour: "#dfad67",
	woodScale: 2,
	lineColour: "black",
	starPoints: "auto",
	padding: 0,
	coords: "A1",
	coordsLocation: "all",
	fontFamily: "Arial, Helvetica, sans-serif",
	moveStatsThreshold: 0.1,
};

const boardContentsCache: WeakMap<HTMLCanvasElement, [BoardContents, Partial<BoardStyle> | undefined]> = new WeakMap();
const boardLocationCache: WeakMap<HTMLCanvasElement, { x: number; y: number; w: number; h: number; s: number; }> =
	new WeakMap();

/**
 * Makes the board automatically re-render the last call to {@linkcode drawBoard} when the canvas is resized.
 * @param canvas The canvas element to draw to.
 * @returns A cleanup function that removes the resize handler and stops the board from automatically re-rendering.
 */
export function enableAutoRender(canvas: HTMLCanvasElement): () => void
{
	const observer = new ResizeObserver(() =>
	{
		const cached = boardContentsCache.get(canvas);
		if (cached !== undefined)
			drawBoard(canvas, ...cached);
	});
	observer.observe(canvas);
	return () => observer.disconnect();
}

/**
 * Finds the coordinates on the board corresponding to the given input event.
 * @param canvas The canvas element where the board was drawn.
 * @param event The input event.
 * @returns The corresponding board location, or `undefined` if out of bounds.
 */
export function hitTest(
	canvas: HTMLCanvasElement,
	event: { clientX: number; clientY: number; },
): Coord | undefined
{
	const location = boardLocationCache.get(canvas);
	if (!location)
		return undefined;

	const rect = canvas.getBoundingClientRect();
	const x = Math.floor(
		((event.clientX - rect.left - canvas.clientLeft) * devicePixelRatio - location.x) / location.s,
	);
	const y = Math.floor(((event.clientY - rect.top - canvas.clientTop) * devicePixelRatio - location.y) / location.s);
	if (x < 0 || y < 0 || x >= location.w || y >= location.h)
		return undefined;

	return [x, y];
}

/**
 * Draws the board onto the canvas.
 * @param canvas The canvas element to draw to.
 * @param contents The contents of the board.
 * @param style Styling information.
 */
export function drawBoard(canvas: HTMLCanvasElement, contents: BoardContents, style?: Partial<BoardStyle>)
{
	const fullStyle: BoardStyle = { ...defaultStyle, ...style };
	boardContentsCache.set(canvas, [contents, style]);
	const w = canvas.width = canvas.clientWidth * devicePixelRatio;
	const h = canvas.height = canvas.clientHeight * devicePixelRatio;
	const ctx = canvas.getContext("2d")!;

	ctx.clearRect(0, 0, w, h);

	const coordSides = getCoordSides();
	const paddingTop = fullStyle.padding + (coordSides.top ? 1 : 0);
	const paddingBottom = fullStyle.padding + (coordSides.bottom ? 1 : 0);
	const paddingLeft = fullStyle.padding + (coordSides.left ? 1 : 0);
	const paddingRight = fullStyle.padding + (coordSides.right ? 1 : 0);
	const s = Math.floor(
				(Math.min(
					w / (contents.width + paddingLeft + paddingRight),
					h / (contents.height + paddingTop + paddingBottom),
				) + 1) * 0.5,
			) * 2 - 1;
	const paddingTopPx = Math.floor(paddingTop * s);
	const paddingBottomPx = Math.floor(paddingBottom * s);
	const paddingLeftPx = Math.floor(paddingLeft * s);
	const paddingRightPx = Math.floor(paddingRight * s);
	const boardWidth = contents.width * s + paddingLeftPx + paddingRightPx;
	const boardHeight = contents.height * s + paddingTopPx + paddingBottomPx;
	const boardX = Math.floor((w - boardWidth) * 0.5) + paddingLeftPx;
	const boardY = Math.floor((h - boardHeight) * 0.5) + paddingTopPx;
	boardLocationCache.set(canvas, { x: boardX, y: boardY, w: contents.width, h: contents.height, s });
	ctx.translate(boardX, boardY);
	ctx.beginPath();
	ctx.rect(-paddingLeftPx, -paddingTopPx, boardWidth, boardHeight);
	ctx.clip();

	const stones = new Map<string, string>(
		contents.stones.map(([[x, y], colour]) => [`${x},${y}`, colour]),
	);

	drawBackground();
	drawOwnership();
	drawLines();
	drawStones();
	drawLastMove();
	drawPolicy();
	drawLabels();
	drawMarkupLines();
	drawMoves();
	drawNextMove();
	drawCursor();
	return;

	function drawBackground()
	{
		ctx.fillStyle = fullStyle.backgroundColour;
		ctx.fillRect(-paddingLeftPx, -paddingTopPx, boardWidth, boardHeight);
		if (fullStyle.woodColour !== null)
		{
			const gradient = ctx.createLinearGradient(-paddingLeftPx, 0, -paddingLeftPx + boardWidth, 0);
			let a = boardWidth;
			for (let x = 0; x < boardWidth; x += fullStyle.woodScale * devicePixelRatio)
			{
				a = (a * 0x9E35) & 0xFFFF;
				const alpha = ((a ^ (a >> 8)) & 0xFF) / 255;
				gradient.addColorStop(x / boardWidth, `color(from ${fullStyle.woodColour} srgb r g b / ${alpha})`);
			}
			ctx.fillStyle = gradient;
			ctx.fillRect(-paddingLeftPx, -paddingTopPx, boardWidth, boardHeight);
		}
	}

	function drawOwnership()
	{
		if (!contents.ownership)
			return;

		const image = new OffscreenCanvas(contents.width * 2 + 1, contents.height * 2 + 1);
		const imageCtx = image.getContext("2d")!;
		const imageData = imageCtx.createImageData(image.width, image.height);
		for (let y = 0; y < contents.height; y++)
		{
			for (let x = 0; x < contents.width; x++)
			{
				const ownership = contents.ownership[y * contents.width + x] ?? 0;
				const index = ((y * 2 + 1) * image.width + (x * 2) + 1) * 4;
				const r = ownership > 0 ? 255 : 0;
				imageData.data[index + 0] = r;
				imageData.data[index + 1] = r;
				imageData.data[index + 2] = r;
				imageData.data[index + 3] = Math.abs(ownership * 0xdf);

				let ownershipl = 0;
				let ownershipt = 0;
				if (x > 0)
				{
					ownershipl = contents.ownership[y * contents.width + x - 1] ?? 0;
					const midOwnership = (ownershipl + ownership) * 0.5;
					const indexl = index - 4;
					const r = midOwnership > 0 ? 255 : 0;
					imageData.data[indexl + 0] = r;
					imageData.data[indexl + 1] = r;
					imageData.data[indexl + 2] = r;
					imageData.data[indexl + 3] = Math.abs(midOwnership * 0xdf);
				}
				if (y > 0)
				{
					ownershipt = contents.ownership[(y - 1) * contents.width + x] ?? 0;
					const midOwnership = (ownershipt + ownership) * 0.5;
					const indext = index - image.width * 4;
					const r = midOwnership > 0 ? 255 : 0;
					imageData.data[indext + 0] = r;
					imageData.data[indext + 1] = r;
					imageData.data[indext + 2] = r;
					imageData.data[indext + 3] = Math.abs(midOwnership * 0xdf);
				}
				if (x > 0 && y > 0)
				{
					const ownershiptl = contents.ownership[(y - 1) * contents.width + x - 1] ?? 0;
					const midOwnership = (ownershiptl + ownershipl + ownershipt + ownership) * 0.25;
					const indextl = index - image.width * 4 - 4;
					const r = midOwnership > 0 ? 255 : 0;
					imageData.data[indextl + 0] = r;
					imageData.data[indextl + 1] = r;
					imageData.data[indextl + 2] = r;
					imageData.data[indextl + 3] = Math.abs(midOwnership * 0xdf);
				}
			}
		}

		imageCtx.putImageData(imageData, 0, 0);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(
			image,
			0.5,
			0.5,
			contents.width * 2,
			contents.height * 2,
			0,
			0,
			contents.width * s,
			contents.height * s,
		);
	}

	function drawLines()
	{
		const linesCanvas = new OffscreenCanvas(contents.width * s, contents.height * s);
		const linesCtx = linesCanvas.getContext("2d")!;
		linesCtx.strokeStyle = fullStyle.lineColour;
		linesCtx.lineWidth = devicePixelRatio;
		linesCtx.lineCap = "square";
		linesCtx.beginPath();
		for (let y = 0; y < contents.height; y++)
		{
			const yPx = (y + 0.5) * s;
			linesCtx.moveTo(0.5 * s, yPx);
			linesCtx.lineTo((contents.width - 0.5) * s, yPx);
		}
		for (let x = 0; x < contents.width; x++)
		{
			const xPx = (x + 0.5) * s;
			linesCtx.moveTo(xPx, 0.5 * s);
			linesCtx.lineTo(xPx, (contents.height - 0.5) * s);
		}
		linesCtx.stroke();

		linesCtx.fillStyle = fullStyle.lineColour;
		let starPoints = fullStyle.starPoints;
		if (starPoints === "auto")
			starPoints = getStarPoints();

		for (const [x, y] of starPoints)
		{
			linesCtx.beginPath();
			linesCtx.arc((x + 0.5) * s, (y + 0.5) * s, 3 * devicePixelRatio, 0, Math.PI * 2);
			linesCtx.fill();
		}

		if (contents.labels)
		{
			for (const [[x, y], _] of contents.labels)
				linesCtx.clearRect(x * s, y * s, s, s);
		}

		ctx.drawImage(linesCanvas, 0, 0);
	}

	function drawStones()
	{
		drawShadows();

		for (const [[x, y], colour] of contents.stones)
		{
			ctx.fillStyle = shineGradient(colour, x, y);
			ctx.beginPath();
			ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.5, 0, Math.PI * 2);
			ctx.fill();
		}

		drawStonesOwnership();
	}

	function drawShadows()
	{
		ctx.save();
		ctx.globalCompositeOperation = "multiply";

		for (const [[x, y], colour] of contents.stones)
		{
			const gradient = ctx.createRadialGradient(
				(x + 0.55) * s,
				(y + 0.55) * s,
				s * 0.3,
				(x + 0.55) * s,
				(y + 0.55) * s,
				s * 0.6,
			);
			gradient.addColorStop(
				0,
				`color(from ${colour} srgb calc(r * 0.5) calc(g * 0.5) calc(b * 0.5))`,
			);
			gradient.addColorStop(
				0.7,
				`color(from ${colour} srgb calc(r * 0.1 + 0.8) calc(g * 0.1 + 0.8) calc(b * 0.1 + 0.8))`,
			);
			gradient.addColorStop(1, "#ffffff");
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc((x + 0.55) * s, (y + 0.55) * s, s * 0.6, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	function drawStonesOwnership()
	{
		if (!contents.ownership)
			return;

		for (const [[x, y], _] of contents.stones)
		{
			const ownership = contents.ownership[y * contents.width + x] ?? 0;
			const colour = ownership > 0 ? `rgb(255 255 255 / ${ownership})` : `rgb(0 0 0 / ${-ownership})`;
			ctx.strokeStyle = shineGradient(colour, x, y);
			ctx.lineWidth = s * 0.15;
			ctx.lineCap = "square";
			ctx.beginPath();
			ctx.moveTo((x + 0.35) * s, (y + 0.35) * s);
			ctx.lineTo((x + 0.65) * s, (y + 0.65) * s);
			ctx.moveTo((x + 0.65) * s, (y + 0.35) * s);
			ctx.lineTo((x + 0.35) * s, (y + 0.65) * s);
			ctx.stroke();
		}
	}

	function drawLastMove()
	{
		if (!contents.lastMove)
			return;

		const [x, y] = contents.lastMove;
		const stone = stones.get(`${x},${y}`);
		if (!stone)
			return;

		let colour = undefined;
		let label = undefined;
		switch (contents.lastMoveType)
		{
			case "brilliant":
				colour = "oklch(0.6 0.2 260)";
				label = "!!";
				break;
			case "excellent":
				colour = "oklch(0.6 0.2 200)";
				label = "!";
				break;
			case "good":
				colour = "oklch(0.6 0.2 140)";
				label = "-";
				break;
			case "mistake":
				colour = "oklch(0.6 0.2 80)";
				label = "?";
				break;
			case "blunder":
				colour = "oklch(0.6 0.2 20)";
				label = "??";
				break;
		}
		ctx.fillStyle = colour ? shineGradient(colour, x, y) : getContrastColour(x, y);
		ctx.beginPath();
		ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.25, 0, Math.PI * 2);
		ctx.fill();

		if (label)
		{
			ctx.fillStyle = shineGradient("#ffffff", x, y);
			ctx.textAlign = "center";
			ctx.textBaseline = "top";
			ctx.font = `bold ${s * 0.35}px ${fullStyle.fontFamily}`;
			const metrics = ctx.measureText(label);
			ctx.fillText(
				label,
				(x + 0.5) * s,
				(y + 0.5) * s - (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) * 0.5,
			);
		}
	}

	function drawPolicy()
	{
		if (!contents.policy)
			return;

		for (let i = 0; i < contents.policy.length; i++)
		{
			if (contents.policy[i] > 0.001)
			{
				const x = i % contents.width;
				const y = Math.floor(i / contents.width);
				ctx.beginPath();
				ctx.arc((x + 0.5) * s, (y + 0.5) * s, Math.sqrt(contents.policy[i]) * s * 0.5, 0, 2 * Math.PI);
				ctx.closePath();
				const quality = Math.max(-1, Math.min(1, contents.policyQuality?.[i] ?? 0));
				ctx.fillStyle = `oklch(0.75 0.2 ${140 + quality * 140})`;
				ctx.strokeStyle = fullStyle.lineColour;
				ctx.lineWidth = 0.5 * devicePixelRatio;
				ctx.fill();
				ctx.stroke();
			}
		}
	}

	function drawLabels()
	{
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		ctx.lineWidth = s * 0.075;
		ctx.font = `bold ${s * 0.7}px ${fullStyle.fontFamily}`;
		for (const [[x, y], label] of (contents.labels ?? []).concat(getCoordLabels()))
		{
			const labelColour = getContrastColour(x, y);
			ctx.strokeStyle = labelColour;
			ctx.fillStyle = labelColour;
			switch (label)
			{
				case "circle":
					ctx.beginPath();
					ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.25, 0, Math.PI * 2);
					ctx.closePath();
					ctx.stroke();
					break;
				case "cross":
					ctx.lineCap = "square";
					ctx.beginPath();
					ctx.moveTo((x + 0.25) * s, (y + 0.25) * s);
					ctx.lineTo((x + 0.75) * s, (y + 0.75) * s);
					ctx.moveTo((x + 0.75) * s, (y + 0.25) * s);
					ctx.lineTo((x + 0.25) * s, (y + 0.75) * s);
					ctx.stroke();
					break;
				case "square":
					ctx.beginPath();
					ctx.rect((x + 0.25) * s, (y + 0.25) * s, s * 0.5, s * 0.5);
					ctx.stroke();
					break;
				case "triangle":
					ctx.beginPath();
					ctx.moveTo((x + 0.5) * s, (y + 0.2) * s);
					ctx.lineTo((x + 0.5 + Math.sqrt(3) * 0.15) * s, (y + 0.65) * s);
					ctx.lineTo((x + 0.5 - Math.sqrt(3) * 0.15) * s, (y + 0.65) * s);
					ctx.closePath();
					ctx.stroke();
					break;
				case "kanji1":
					drawKanjiLabel(drawKanji1, x, y);
					break;
				case "kanji2":
					drawKanjiLabel(drawKanji2, x, y);
					break;
				case "kanji3":
					drawKanjiLabel(drawKanji3, x, y);
					break;
				case "kanji4":
					drawKanjiLabel(drawKanji4, x, y);
					break;
				case "kanji5":
					drawKanjiLabel(drawKanji5, x, y);
					break;
				case "kanji6":
					drawKanjiLabel(drawKanji6, x, y);
					break;
				case "kanji7":
					drawKanjiLabel(drawKanji7, x, y);
					break;
				case "kanji8":
					drawKanjiLabel(drawKanji8, x, y);
					break;
				case "kanji9":
					drawKanjiLabel(drawKanji9, x, y);
					break;
				case "kanji10":
					drawKanjiLabel(drawKanji10, x, y);
					break;
				case "kanji11":
					drawKanjiLabel2(drawKanji1, x, y);
					break;
				case "kanji12":
					drawKanjiLabel2(drawKanji2, x, y);
					break;
				case "kanji13":
					drawKanjiLabel2(drawKanji3, x, y);
					break;
				case "kanji14":
					drawKanjiLabel2(drawKanji4, x, y);
					break;
				case "kanji15":
					drawKanjiLabel2(drawKanji5, x, y);
					break;
				case "kanji16":
					drawKanjiLabel2(drawKanji6, x, y);
					break;
				case "kanji17":
					drawKanjiLabel2(drawKanji7, x, y);
					break;
				case "kanji18":
					drawKanjiLabel2(drawKanji8, x, y);
					break;
				case "kanji19":
					drawKanjiLabel2(drawKanji9, x, y);
					break;
				default:
				{
					const metrics = ctx.measureText(label);
					ctx.fillText(
						label,
						(x + 0.5) * s,
						(y + 0.5) * s - (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) * 0.5,
					);
					break;
				}
			}
		}

		function drawKanjiLabel(draw: (x: number, y: number) => void, x: number, y: number)
		{
			ctx.beginPath();
			draw(x, y);
			ctx.lineCap = "butt";
			ctx.stroke();
		}

		function drawKanjiLabel2(draw2: (x: number, y: number) => void, x: number, y: number)
		{
			ctx.save();
			ctx.scale(1, 0.5);
			ctx.beginPath();
			drawKanji10(x, y * 2 + 0.15);
			draw2(x, y * 2 + 0.85);
			ctx.restore();
			ctx.lineCap = "butt";
			ctx.stroke();
		}

		function drawKanji1(x: number, y: number)
		{
			ctx.moveTo((x + 0.22) * s, (y + 0.5) * s);
			ctx.lineTo((x + 0.78) * s, (y + 0.5) * s);
		}

		function drawKanji2(x: number, y: number)
		{
			ctx.moveTo((x + 0.26) * s, (y + 0.3) * s);
			ctx.lineTo((x + 0.74) * s, (y + 0.3) * s);
			ctx.moveTo((x + 0.2) * s, (y + 0.7) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.7) * s);
		}

		function drawKanji3(x: number, y: number)
		{
			ctx.moveTo((x + 0.25) * s, (y + 0.28) * s);
			ctx.lineTo((x + 0.75) * s, (y + 0.28) * s);
			ctx.moveTo((x + 0.29) * s, (y + 0.5) * s);
			ctx.lineTo((x + 0.71) * s, (y + 0.5) * s);
			ctx.moveTo((x + 0.2) * s, (y + 0.72) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.72) * s);
		}

		function drawKanji4(x: number, y: number)
		{
			ctx.moveTo((x + 0.25) * s, (y + 0.78) * s);
			ctx.lineTo((x + 0.25) * s, (y + 0.25) * s);
			ctx.lineTo((x + 0.75) * s, (y + 0.25) * s);
			ctx.lineTo((x + 0.75) * s, (y + 0.78) * s);
			ctx.moveTo((x + 0.25) * s, (y + 0.7) * s);
			ctx.lineTo((x + 0.75) * s, (y + 0.7) * s);
			ctx.moveTo((x + 0.42) * s, (y + 0.25) * s);
			ctx.bezierCurveTo(
				(x + 0.42) * s,
				(y + 0.45) * s,
				(x + 0.4) * s,
				(y + 0.5) * s,
				(x + 0.32) * s,
				(y + 0.58) * s,
			);
			ctx.moveTo((x + 0.57) * s, (y + 0.25) * s);
			ctx.lineTo((x + 0.57) * s, (y + 0.45) * s);
			ctx.bezierCurveTo(
				(x + 0.57) * s,
				(y + 0.5) * s,
				(x + 0.60) * s,
				(y + 0.53) * s,
				(x + 0.65) * s,
				(y + 0.53) * s,
			);
			ctx.lineTo((x + 0.7) * s, (y + 0.53) * s);
		}

		function drawKanji5(x: number, y: number)
		{
			ctx.moveTo((x + 0.22) * s, (y + 0.26) * s);
			ctx.lineTo((x + 0.78) * s, (y + 0.26) * s);
			ctx.moveTo((x + 0.47) * s, (y + 0.26) * s);
			ctx.lineTo((x + 0.36) * s, (y + 0.74) * s);
			ctx.moveTo((x + 0.27) * s, (y + 0.46) * s);
			ctx.lineTo((x + 0.65) * s, (y + 0.46) * s);
			ctx.lineTo((x + 0.65) * s, (y + 0.74) * s);
			ctx.moveTo((x + 0.2) * s, (y + 0.74) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.74) * s);
		}

		function drawKanji6(x: number, y: number)
		{
			ctx.moveTo((x + 0.5) * s, (y + 0.2) * s);
			ctx.lineTo((x + 0.5) * s, (y + 0.37) * s);
			ctx.moveTo((x + 0.2) * s, (y + 0.37) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.37) * s);
			ctx.moveTo((x + 0.39) * s, (y + 0.48) * s);
			ctx.bezierCurveTo(
				(x + 0.35) * s,
				(y + 0.62) * s,
				(x + 0.32) * s,
				(y + 0.65) * s,
				(x + 0.22) * s,
				(y + 0.77) * s,
			);
			ctx.moveTo((x + 0.61) * s, (y + 0.48) * s);
			ctx.bezierCurveTo(
				(x + 0.65) * s,
				(y + 0.62) * s,
				(x + 0.68) * s,
				(y + 0.65) * s,
				(x + 0.78) * s,
				(y + 0.77) * s,
			);
		}

		function drawKanji7(x: number, y: number)
		{
			ctx.moveTo((x + 0.2) * s, (y + 0.47) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.36) * s);
			ctx.moveTo((x + 0.4) * s, (y + 0.2) * s);
			ctx.lineTo((x + 0.4) * s, (y + 0.65) * s);
			ctx.bezierCurveTo(
				(x + 0.4) * s,
				(y + 0.72) * s,
				(x + 0.45) * s,
				(y + 0.74) * s,
				(x + 0.55) * s,
				(y + 0.74) * s,
			);
			ctx.bezierCurveTo(
				(x + 0.65) * s,
				(y + 0.74) * s,
				(x + 0.73) * s,
				(y + 0.74) * s,
				(x + 0.73) * s,
				(y + 0.59) * s,
			);
		}

		function drawKanji8(x: number, y: number)
		{
			ctx.moveTo((x + 0.39) * s, (y + 0.35) * s);
			ctx.bezierCurveTo(
				(x + 0.37) * s,
				(y + 0.55) * s,
				(x + 0.31) * s,
				(y + 0.65) * s,
				(x + 0.21) * s,
				(y + 0.75) * s,
			);
			ctx.moveTo((x + 0.36) * s, (y + 0.26) * s);
			ctx.lineTo((x + 0.59) * s, (y + 0.26) * s);
			ctx.bezierCurveTo(
				(x + 0.59) * s,
				(y + 0.5) * s,
				(x + 0.69) * s,
				(y + 0.65) * s,
				(x + 0.79) * s,
				(y + 0.75) * s,
			);
		}

		function drawKanji9(x: number, y: number)
		{
			ctx.moveTo((x + 0.44) * s, (y + 0.2) * s);
			ctx.bezierCurveTo(
				(x + 0.44) * s,
				(y + 0.55) * s,
				(x + 0.4) * s,
				(y + 0.64) * s,
				(x + 0.21) * s,
				(y + 0.76) * s,
			);
			ctx.moveTo((x + 0.21) * s, (y + 0.38) * s);
			ctx.lineTo((x + 0.63) * s, (y + 0.38) * s);
			ctx.lineTo((x + 0.63) * s, (y + 0.69) * s);
			ctx.bezierCurveTo(
				(x + 0.63) * s,
				(y + 0.75) * s,
				(x + 0.68) * s,
				(y + 0.75) * s,
				(x + 0.71) * s,
				(y + 0.75) * s,
			);
			ctx.bezierCurveTo(
				(x + 0.76) * s,
				(y + 0.75) * s,
				(x + 0.79) * s,
				(y + 0.73) * s,
				(x + 0.79) * s,
				(y + 0.62) * s,
			);
		}

		function drawKanji10(x: number, y: number)
		{
			ctx.moveTo((x + 0.5) * s, (y + 0.2) * s);
			ctx.lineTo((x + 0.5) * s, (y + 0.8) * s);
			ctx.moveTo((x + 0.2) * s, (y + 0.5) * s);
			ctx.lineTo((x + 0.8) * s, (y + 0.5) * s);
		}
	}

	function drawMarkupLines()
	{
		ctx.fillStyle = fullStyle.lineColour;
		ctx.strokeStyle = fullStyle.lineColour;
		ctx.lineWidth = s * 0.075;
		ctx.lineCap = "round";
		if (contents.lines)
		{
			for (const [[x1, y1], [x2, y2]] of contents.lines)
			{
				ctx.beginPath();
				ctx.moveTo((x1 + 0.5) * s, (y1 + 0.5) * s);
				ctx.lineTo((x2 + 0.5) * s, (y2 + 0.5) * s);
				ctx.stroke();
			}
		}
		if (contents.arrows)
		{
			for (const [[x1, y1], [x2, y2]] of contents.arrows)
			{
				const angle = Math.atan2(y2 - y1, x2 - x1);
				ctx.beginPath();
				ctx.moveTo((x2 + 0.5) * s, (y2 + 0.5) * s);
				ctx.lineTo(
					(x2 + 0.5 - Math.cos(angle - Math.PI / 6) * 0.3) * s,
					(y2 + 0.5 - Math.sin(angle - Math.PI / 6) * 0.3) * s,
				);
				ctx.lineTo(
					(x2 + 0.5 - Math.cos(angle + Math.PI / 6) * 0.3) * s,
					(y2 + 0.5 - Math.sin(angle + Math.PI / 6) * 0.3) * s,
				);
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo((x1 + 0.5) * s, (y1 + 0.5) * s);
				ctx.lineTo((x2 + 0.5 - Math.cos(angle) * 0.2) * s, (y2 + 0.5 - Math.sin(angle) * 0.2) * s);
				ctx.stroke();
			}
		}
	}

	function drawMoves()
	{
		if (!contents.moves)
			return;

		const maxPSV = contents.moves.find(m => m.order === 0)?.playSelectionValue ?? 0;
		if (maxPSV <= 0)
			return;

		ctx.lineWidth = s * 0.15;
		ctx.fillStyle = fullStyle.lineColour;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${s * 0.3}px ${fullStyle.fontFamily}`;
		for (const move of contents.moves)
		{
			const [x, y] = move.move;
			const quality = Math.max(0, Math.log(move.playSelectionValue)) / Math.log(maxPSV);
			const colour = move.order === 0
				? "#00ffff"
				: `oklch(${0.4 + quality * 0.4} 0.3 ${70 + quality * 70} / ${0.1 + quality * 0.9})`;
			const gradient = ctx.createRadialGradient(
				(x + 0.5) * s,
				(y + 0.5) * s,
				s * 0.5,
				(x + 0.5) * s,
				(y + 0.5) * s,
				s * 0.5 - ctx.lineWidth,
			);
			gradient.addColorStop(0, colour);
			gradient.addColorStop(1, `rgb(from ${colour} r g b / 0)`);
			ctx.strokeStyle = gradient;
			ctx.beginPath();
			ctx.arc((x + 0.5) * s, (y + 0.5) * s, (s - ctx.lineWidth) * 0.5, 0, 2 * Math.PI);
			ctx.closePath();
			ctx.stroke();
			if (quality > fullStyle.moveStatsThreshold)
			{
				ctx.fillText((move.winrate * 100).toFixed(1), (x + 0.5) * s, (y + 0.25) * s);
				ctx.fillText(move.scoreLead.toFixed(1), (x + 0.5) * s, (y + 0.5) * s);
				ctx.fillText(abbreviateNumber(move.visits), (x + 0.5) * s, (y + 0.75) * s);
			}
		}
	}

	function drawNextMove()
	{
		if (!contents.nextMove)
			return;

		const [[x, y], colour] = contents.nextMove;
		ctx.lineWidth = s * 0.05;
		ctx.strokeStyle = colour;
		ctx.lineCap = "butt";
		const r = (s - ctx.lineWidth) * 0.5;
		ctx.setLineDash([r * Math.PI * 0.0625, r * Math.PI * 0.0625]);
		ctx.beginPath();
		ctx.arc((x + 0.5) * s, (y + 0.5) * s, r, 0, Math.PI * 2);
		ctx.closePath();
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawCursor()
	{
		if (!contents.cursor)
			return;

		const [[x, y], colour] = contents.cursor;
		ctx.fillStyle = `rgb(from ${colour} r g b / 0.5)`;
		ctx.beginPath();
		ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.25, 0, 2 * Math.PI);
		ctx.fill();
	}

	function getStarPoints(): Coord[]
	{
		const starPoints: Coord[] = [];

		if (contents.width % 2 === 1 && contents.height % 2 === 1)
		{
			// Tengen
			starPoints.push([(contents.width - 1) * 0.5, (contents.height - 1) * 0.5]);
		}

		if (contents.width === 9 && contents.height === 9)
		{
			// 3-3 points
			starPoints.push([2, 2]);
			starPoints.push([2, 6]);
			starPoints.push([6, 2]);
			starPoints.push([6, 6]);
		}
		else if (contents.width > 9 && contents.height > 9)
		{
			// 4-4 points
			starPoints.push([3, 3]);
			starPoints.push([3, contents.height - 4]);
			starPoints.push([contents.width - 4, 3]);
			starPoints.push([contents.width - 4, contents.height - 4]);
		}

		if (contents.width >= 19 && contents.height >= 19)
		{
			if (contents.width % 2 === 1)
			{
				// Side star points
				starPoints.push([(contents.width - 1) * 0.5, 3]);
				starPoints.push([(contents.width - 1) * 0.5, contents.height - 4]);
			}
			if (contents.height % 2 === 1)
			{
				// Side star points
				starPoints.push([3, (contents.height - 1) * 0.5]);
				starPoints.push([contents.width - 4, (contents.height - 1) * 0.5]);
			}
		}
		return starPoints;
	}

	function getContrastColour(x: number, y: number): string | CanvasGradient
	{
		const stoneColour = stones.get(`${x},${y}`);
		return stoneColour !== undefined
			? shineGradient(`oklch(from ${stoneColour} calc(max(0, min(1, (l - 0.5) * -infinity))) 0 0)`, x, y)
			: fullStyle.lineColour;
	}

	function shineGradient(colour: string, x: number, y: number)
	{
		const gradient = ctx.createRadialGradient(
			(x + 0.35) * s,
			(y + 0.35) * s,
			0,
			(x + 0.35) * s,
			(y + 0.35) * s,
			s * 0.7,
		);
		gradient.addColorStop(
			0,
			`color(from ${colour} srgb calc(r * 0.75 + 0.25) calc(g * 0.75 + 0.25) calc(b * 0.75 + 0.25))`,
		);
		gradient.addColorStop(
			1,
			`color(from ${colour} srgb calc(r * 0.75) calc(g * 0.75) calc(b * 0.75))`,
		);
		return gradient;
	}

	function getCoordSides(): { top: boolean; bottom: boolean; left: boolean; right: boolean; }
	{
		switch (fullStyle.coordsLocation)
		{
			case "all":
				return { top: true, bottom: true, left: true, right: true };
			case "none":
				return { top: false, bottom: false, left: false, right: false };
			case "top-left":
				return { top: true, bottom: false, left: true, right: false };
			case "bottom-left":
				return { top: false, bottom: true, left: true, right: false };
			case "top-right":
				return { top: true, bottom: false, left: false, right: true };
			case "bottom-right":
				return { top: false, bottom: true, left: false, right: true };
		}
	}

	function getCoordLabels(): [Coord, string][]
	{
		let xLabels;
		let yLabels;
		switch (fullStyle.coords)
		{
			case "A1":
				xLabels = "ABCDEFGHJKLMNOPQRSTUVWXYZ".slice(0, contents.width).split("").slice(0, contents.width);
				yLabels = Array.from({ length: contents.height }, (_, i) => (i + 1).toString()).reverse();
				break;
			case "kanji":
				xLabels = Array.from({ length: contents.width }, (_, i) => (i + 1).toString());
				yLabels = [
					"kanji1",
					"kanji2",
					"kanji3",
					"kanji4",
					"kanji5",
					"kanji6",
					"kanji7",
					"kanji8",
					"kanji9",
					"kanji10",
					"kanji11",
					"kanji12",
					"kanji13",
					"kanji14",
					"kanji15",
					"kanji16",
					"kanji17",
					"kanji18",
					"kanji19",
				].slice(0, contents.height);
				break;
		}
		const labels: [Coord, string][] = [];
		if (coordSides.top)
			labels.push(...xLabels.map((label, i) => [[i, -1], label] satisfies [Coord, string]));
		if (coordSides.bottom)
			labels.push(...xLabels.map((label, i) => [[i, contents.height], label] satisfies [Coord, string]));
		if (coordSides.left)
			labels.push(...yLabels.map((label, i) => [[-1, i], label] satisfies [Coord, string]));
		if (coordSides.right)
			labels.push(...yLabels.map((label, i) => [[contents.width, i], label] satisfies [Coord, string]));
		return labels;
	}

	function abbreviateNumber(value: number): string
	{
		let magnitudes = 0;
		while (value >= 1000)
		{
			value /= 1000;
			magnitudes++;
		}
		const suffixes = ["", "k", "m", "b", "t", "?"];
		return (value >= 10 || magnitudes === 0 ? Math.floor(value).toFixed() : value.toFixed(1))
			+ suffixes[Math.min(suffixes.length - 1, magnitudes)];
	}
}
