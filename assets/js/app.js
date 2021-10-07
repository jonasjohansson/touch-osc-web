const LAYOUT = {};
LAYOUT.grid = 20;
const fscale = 10000;

var socket = new WebSocket('ws://192.168.1.23:5000');

window.onload = () => {
	loadZipFile('assets/touch/rotarytest.touchosc');
};

function parseXml(xmlStr) {
	// console.log('parsing xml', xmlStr);
	data = xml2js(xmlStr, { compact: true, spaces: 4 });
	tidy(data);
	// console.log('parsed json', data);
	drawInterface(data);
	window.onload = setSize();
}

function loadZipFile(url) {
	fetch(url)
		.then((r) => r.arrayBuffer())
		.then((buffer) => {
			const bytebuffer = new Uint8Array(buffer);
			const unzipper = new fflate.Unzip();
			unzipper.register(fflate.UnzipInflate);
			unzipper.onfile = (file) => {
				console.log('unzipper found a file', file);
				if (file.name === 'index.xml') {
					let xmlbytes = new Uint8Array();
					file.ondata = (err, data, final) => {
						let newxmlbytes = new Uint8Array(xmlbytes.length + data.length);
						newxmlbytes.set(xmlbytes, 0);
						newxmlbytes.set(data, xmlbytes.length);
						xmlbytes = newxmlbytes;
						if (final) {
							const td = new TextDecoder();
							const xmltext = td.decode(xmlbytes);
							parseXml(xmltext);
						}
					};
					file.start();
				}
			};
			unzipper.push(bytebuffer, true);
		});
}

function loadFile(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.arguments = Array.prototype.slice.call(arguments, 2);
	xhr.onload = () => {
		const serializer = new XMLSerializer();
		const dom = xhr.responseXML.documentElement;
		const xmlStr = serializer.serializeToString(dom);
		parseXml(xmlStr);
	};
	xhr.open('GET', url, true);
	xhr.send(null);
}

function tidy(data) {
	data.layout.attr = data.layout._attributes;
	delete data.layout._attributes;
	if (!Array.isArray(data.layout.tabpage)) {
		data.layout.tabpage = new Array(data.layout.tabpage);
	}
	for (let page of data.layout.tabpage) {
		page.attr = page._attributes;
		page.attr.name = atob(page.attr.name);
		delete page._attributes;
		if (!Array.isArray(page.control)) {
			page.control = new Array(page.control);
		}
		for (let control of page.control) {
			control.attr = control._attributes;
			control.attr.name = atob(control.attr.name);
			console.log(control.attr);
			control.attr.addr = control.attr['osc_cs']
				? atob(control.attr.osc_cs)
				: `/${page.attr.name}/${control.attr.name}`;
			delete control._attributes;
			for (const [key, value] of Object.entries(control.attr)) {
				if (value === 'false') control.attr[key] = false;
				if (value === 'true') control.attr[key] = true;
			}
		}
	}
}

function drawInterface(data) {
	const aside = document.createElement('aside');
	const main = document.createElement('main');
	document.body.appendChild(aside);
	document.body.appendChild(main);
	LAYOUT.w = data.layout.attr.w || 960;
	LAYOUT.h = data.layout.attr.h - 40 || 540;
	LAYOUT.o = data.layout.attr.orientation;
	LAYOUT.cols = Math.ceil(LAYOUT.w / LAYOUT.grid);
	LAYOUT.rows = Math.ceil(LAYOUT.h / LAYOUT.grid);

	if (data.layout.tabpage.length !== 1) document.body.classList.add('multi-page');
	document.body.style.setProperty('--count', data.layout.tabpage.length);

	for (let page of data.layout.tabpage) {
		let sectionHandler = document.createElement('a');
		sectionHandler.textContent = page.attr.name;
		let section = document.createElement('section');
		sectionHandler.addEventListener('click', () => {
			for (let el of aside.childNodes) {
				el.classList.remove('active');
			}
			for (let el of main.childNodes) {
				el.classList.remove('show');
			}
			sectionHandler.classList.add('active');
			section.classList.add('show');
		});
		aside.appendChild(sectionHandler);
		main.appendChild(section);
		sectionHandler.addEventListener('click', () => {});

		for (let control of page.control) {
			const div = $('div', control.attr.type, control.attr.name);
			div.style.setProperty('--x', Math.ceil(control.attr.x / LAYOUT.grid + 1));
			div.style.setProperty('--y', Math.ceil(control.attr.y / LAYOUT.grid + 1));
			div.style.setProperty('--w', Math.ceil(control.attr.w / LAYOUT.grid));
			div.style.setProperty('--h', Math.ceil(control.attr.h / LAYOUT.grid));
			div.style.setProperty('--color', `var(--${control.attr.color})`);
			let el = null;
			// div.textContent = control.attr.name;
			switch (control.attr.type) {
				case 'push':
					el = createPushButton(control);
					break;
				case 'toggle':
					el = createToggleButton(control);
					break;
				case 'labelv':
				case 'labelh':
					div.textContent = atob(control.attr.name);
					break;
				case 'rotaryh':
				case 'rotaryv':
					el = createRotary(control);
					break;
				case 'faderh':
				case 'faderv':
					el = createFader(control);
					break;
			}
			if (el !== null) {
				div.appendChild(el);
				let label = document.createElement('span');
				label.textContent = control.attr.name;

				div.style.setProperty('--val', el.value);
				div.appendChild(label);
			}
			section.appendChild(div);
		}
	}
	aside.childNodes[0].classList.add('active');
	main.childNodes[0].classList.add('show');

	const grid = document.createElement('section');
	grid.id = 'grid';
	for (let x = 0; x < LAYOUT.rows; x++) {
		for (let y = 0; y < LAYOUT.cols; y++) {
			const cell = document.createElement('div');
			grid.appendChild(cell);
		}
	}
	main.appendChild(grid);
}

function getDataObject(addr, type, val) {
	return {
		address: addr,
		args: [
			{
				type: type,
				value: val,
			},
		],
	};
}

function send(data) {
	data = JSON.stringify(data);
	if (socket.readyState == socket.OPEN) {
		socket.send(data);
		console.log(`Sending message => ${data}`);
	}
}

function setSize() {
	const rowData = `repeat(${LAYOUT.rows}, calc(100% / ${LAYOUT.rows}))`;
	const colData = `repeat(${LAYOUT.cols}, calc(100% / ${LAYOUT.cols}))`;
	document.body.style.setProperty('--grid-rows', rowData);
	document.body.style.setProperty('--grid-columns', colData);
}

function $(type = 'div', className, id) {
	const el = document.createElement(type);
	if (type === 'div') {
		el.className = className;
		el.id = id;
	}
	// el.setAttribute('data-id', id);
	return el;
}

const createPushButton = (control) => {
	let el = document.createElement('input');
	el.type = 'button';
	let msg = getDataObject(control.attr.addr, 'f', 1.0);
	el.onclick = send(msg);
	return el;
};

const createToggleButton = (control) => {
	let el = document.createElement('input');
	el.type = 'checkbox';
	el.value = el.checked ? 1 : 0;
	let msg = getDataObject(control.attr.addr, 'f', el.value);
	el.onclick = send(msg);
	return el;
};

const createRotary = (control) => {
	let el = document.createElement('x-rotary');
	el.min = !control.attr.inverted ? parseInt(control.attr.scalef) * fscale : parseInt(control.attr.scalet) * fscale;
	el.max = !control.attr.inverted ? parseInt(control.attr.scalet) * fscale : parseInt(control.attr.scalef) * fscale;
	if (control.attr.centered) {
		el.value = Math.abs(el.min - el.max) / 2;
	}
	el.onchange = () => {
		let val = el.value / fscale;
		el.parentNode.style.setProperty('--val', val);
		let msg = getDataObject(control.attr.addr, 'f', val);
		send(msg);
	};
	return el;
};

const createFader = (control) => {
	let el = document.createElement('input');
	el.type = 'range';
	el.min = !control.attr.inverted ? parseInt(control.attr.scalef) * fscale : parseInt(control.attr.scalet) * fscale;
	el.max = !control.attr.inverted ? parseInt(control.attr.scalet) * fscale : parseInt(control.attr.scalef) * fscale;
	el.value = 0;
	console.log(control.attr.centered);
	if (control.attr.centered) {
		el.value = 0.5;
	}
	el.addEventListener('input', (e) => {
		let val = el.value / fscale;
		el.parentNode.style.setProperty('--val', val);
	});
	el.addEventListener('change', (e) => {
		let val = el.value / fscale;
		let msg = getDataObject(control.attr.addr, 'f', val);
		send(msg);
	});
	return el;
};
