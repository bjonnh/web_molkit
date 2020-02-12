/*
	WebMolKit

	(c) 2010-2020 Molecular Materials Informatics, Inc.

	All rights reserved

	http://molmatinf.com

	[PKG=webmolkit]
*/

///<reference path='../dialog/Dialog.ts'/>
///<reference path='../data/Molecule.ts'/>
///<reference path='../data/AbbrevContainer.ts'/>
///<reference path='../gfx/Rendering.ts'/>
///<reference path='../gfx/ArrangeMolecule.ts'/>
///<reference path='../gfx/DrawMolecule.ts'/>
///<reference path='../ui/TabBar.ts'/>
///<reference path='../ui/OptionList.ts'/>
///<reference path='GeomWidget.ts'/>
///<reference path='ExtraFieldsWidget.ts'/>

namespace WebMolKit /* BOF */ {

/*
	Options for editing a single atom within a molecule.
*/

interface EditAtomAbbrev
{
	tr:JQuery;
	idx:number;
	bgcol:string;
}

export class EditAtom extends Dialog
{
	public mol:Molecule; // copy of original: may or may not be different
	public newX = 0;
	public newY = 0;

	private initMol:Molecule;
	private btnApply:JQuery;
	private tabs:TabBar;

	private inputSymbol:JQuery;
	private inputCharge:JQuery;
	private inputUnpaired:JQuery;
	private optionHydrogen:OptionList;
	private inputHydrogen:JQuery;
	private optionIsotope:OptionList;
	private inputIsotope:JQuery;
	private inputMapping:JQuery;
	private inputIndex:JQuery;

	private abbrevList:AbbrevContainerFrag[] = null;
	private inputAbbrevSearch:JQuery;
	private tableAbbrev:JQuery;
	private svgAbbrev:string[] = null;
	private abbrevEntries:EditAtomAbbrev[];
	private currentAbbrev = -1;

	private inputGeom1:JQuery;
	private inputGeom2:JQuery;
	private geomWidget:GeomWidget;
	private refGeom1:string;
	private refGeom2:string;

	// (...querystuff)

	private fieldsWidget:ExtraFieldsWidget;

	constructor(mol:Molecule, public atom:number, private callbackApply:(source?:EditAtom) => void)
	{
		super();

		this.initMol = mol;
		this.mol = mol.clone();

		this.title = 'Edit Atom';
		this.minPortionWidth = 20;
		this.maxPortionWidth = 95;
	}

	// builds the dialog content
	protected populate():void
	{
		let buttons = this.buttons(), body = this.body();

		buttons.append(this.btnClose); // easy way to reorder
		buttons.append(' ');
		this.btnApply = $('<button class="wmk-button wmk-button-primary">Apply</button>').appendTo(buttons);
		this.btnApply.click(() => this.applyChanges());

		this.tabs = new TabBar(['Atom', 'Abbreviation', 'Geometry', 'Query', 'Extra']);
		this.tabs.render(body);
		this.tabs.callbackSelect = (idx) =>
		{
			if (idx == 0) this.inputSymbol.focus();
			else if (idx == 1) this.inputAbbrevSearch.focus();
			else if (idx == 2) this.inputGeom1.focus();
		};

		this.populateAtom(this.tabs.getPanel('Atom'));
		this.populateAbbreviation(this.tabs.getPanel('Abbreviation'));
		this.populateGeometry(this.tabs.getPanel('Geometry'));
		this.populateQuery(this.tabs.getPanel('Query'));
		this.populateExtra(this.tabs.getPanel('Extra'));

		body.find('input').each((idx, child) =>
		{
			let dom = $(child).css({'font': 'inherit'});
			if (idx == 0) dom.focus();
			dom.keydown((event:KeyboardEvent) =>
			{
				let keyCode = event.keyCode || event.which;
				if (keyCode == 13) this.applyChanges();
				if (keyCode == 27) this.close();
			});
		});

//		setTimeout(() => this.inputSymbol.focus(), 1);
	}

	// ------------ private methods ------------

	// trigger the apply/save sequence
	private applyChanges():void
	{
		this.mol.keepTransient = true;
		
		this.updateMolecule();
		if (this.tabs.getSelectedValue() == 'Abbreviation') this.updateAbbrev();
		if (this.tabs.getSelectedValue() == 'Geometry') this.updateGeometry();
		// ... query...
		if (this.tabs.getSelectedValue() == 'Extra') this.updateExtra();

		this.mol.keepTransient = false;

		if (this.callbackApply) this.callbackApply(this);
	}

	private populateAtom(panel:JQuery):void
	{
		let grid = $('<div/>').appendTo(panel);
		grid.css({'display': 'grid', 'align-items': 'center', 'justify-content': 'start'});
		grid.css({'grid-row-gap': '0.5em', 'grid-column-gap': '0.5em'});
		grid.css('grid-template-columns', '[start col0] auto [col1] auto [col2] auto [col3] auto [col4 end]');

		grid.append('<div style="grid-area: 1 / col0;">Symbol</div>');
		this.inputSymbol = $('<input size="20"/>').appendTo(grid);
		this.inputSymbol.css('grid-area', '1 / col1 / auto / col4');

		grid.append('<div style="grid-area: 2 / col0;">Charge</div>');
		this.inputCharge = $('<input type="number" size="6"/>').appendTo(grid);
		this.inputCharge.css('grid-area', '2 / col1');

		grid.append('<div style="grid-area: 2 / col2;">Unpaired</div>');
		this.inputUnpaired = $('<input type="number" size="6"/>').appendTo(grid);
		this.inputUnpaired.css('grid-area', '2 / col3');

		grid.append('<div style="grid-area: 3 / col0;">Hydrogens</div>');
		this.optionHydrogen = new OptionList(['Auto', 'Explicit']);
		this.optionHydrogen.render($('<div style="grid-area: 3 / col1 / auto / col3"/>').appendTo(grid));
		this.inputHydrogen = $('<input type="number" size="6"/>').appendTo(grid);
		this.inputHydrogen.css('grid-area', '3 / col3');

		grid.append('<div style="grid-area: 4 / col0;">Isotope</div>');
		this.optionIsotope = new OptionList(['Natural', 'Enriched']);
		this.optionIsotope.render($('<div style="grid-area: 4 / col1 / auto / col3"/>').appendTo(grid));
		this.inputIsotope = $('<input type="number" size="6"/>').appendTo(grid);
		this.inputIsotope.css('grid-area', '4 / col3');

		grid.append('<div style="grid-area: 5 / col0;">Mapping</div>');
		this.inputMapping = $('<input type="number" size="6"/>').appendTo(grid);
		this.inputMapping.css('grid-area', '5 / col1');

		grid.append('<div style="grid-area: 5 / col2;">Index</div>');
		this.inputIndex = $('<input type="number" size="6" readonly="readonly"/>').appendTo(grid);
		this.inputIndex.css('grid-area', '5 / col3');

		const mol = this.mol, atom = this.atom;
		if (atom > 0)
		{
			this.inputSymbol.val(mol.atomElement(atom));
			this.inputCharge.val(mol.atomCharge(atom).toString());
			this.inputUnpaired.val(mol.atomUnpaired(atom).toString());
			this.optionHydrogen.setSelectedIndex(mol.atomHExplicit(atom) == Molecule.HEXPLICIT_UNKNOWN ? 0 : 1);
			if (mol.atomHExplicit(atom) != Molecule.HEXPLICIT_UNKNOWN) this.inputHydrogen.val(mol.atomHExplicit(atom).toString());
			this.optionIsotope.setSelectedIndex(mol.atomIsotope(atom) == Molecule.ISOTOPE_NATURAL ? 0 : 1);
			if (mol.atomIsotope(atom) == Molecule.ISOTOPE_NATURAL) this.inputIsotope.val(mol.atomIsotope(atom).toString());
			this.inputMapping.val(mol.atomMapNum(atom).toString());
			this.inputIndex.val(atom.toString());
		}
	}

	private populateAbbreviation(panel:JQuery):void
	{
		let divFlex = $('<div/>').appendTo(panel).css({'display': 'flex', 'align-items': 'flex-start'});
		divFlex.css({'max-width': '60vw', 'max-height': '50vh', 'overflow-y': 'scroll'});

		let spanSearch = $('<div/>').appendTo(divFlex).css({'margin-right': '0.5em', 'flex': '0 0'});
		let spanList = $('<div/>').appendTo(divFlex).css({'flex': '1 1 100%'});

		this.inputAbbrevSearch = $('<input size="10"/>').appendTo(spanSearch);
		this.inputAbbrevSearch.attr('placeholder', 'Search');
		let lastSearch = '';
		this.inputAbbrevSearch.on('input', () =>
		{
			let search = this.inputAbbrevSearch.val();
			if (search == lastSearch) return;
			lastSearch = search;
			this.fillAbbreviations();
		});

		let divButtons = $('<div/>').appendTo(spanSearch).css({'margin-top': '0.5em'});
		let btnClear = $('<button class="wmk-button wmk-button-default">Clear</button>').appendTo(divButtons);
		btnClear.click(() =>
		{
			this.selectAbbreviation(-1);
			if (this.atom > 0 && MolUtil.hasAbbrev(this.mol, this.atom)) this.applyChanges();
		});

		this.tableAbbrev = $('<table/>').appendTo(spanList).css({'border-collapse': 'collapse', 'width': '100%'});
		this.fillAbbreviations();
	}

	private populateGeometry(panel:JQuery):void
	{
		const {mol, atom} = this;

		let divContainer1 = $('<div/>').appendTo(panel).css({'text-align': 'center'});
		let divContainer2 = $('<div/>').appendTo(divContainer1).css({'display': 'inline-block'});
		let grid = $('<div/>').appendTo(divContainer2);
		grid.css({'display': 'grid', 'align-items': 'center', 'justify-content': 'start'});
		grid.css({'grid-row-gap': '0.5em', 'grid-column-gap': '0.5em'});
		grid.css('grid-template-columns', '[start col0] auto [col1] auto [col2] auto [col3] auto [col4 end]');

		this.geomWidget = new GeomWidget(GeomWidgetType.Atom, mol, atom);
		this.geomWidget.render($('<div/>').appendTo(grid).css({'grid-area': '1 / col0 / auto / col4', 'text-align': 'center'}));

		let label1 = $('<div/>').appendTo(grid).css({'grid-area': '2 / col0'});
		this.inputGeom1 = $('<input type="number" size="8"/>').appendTo(grid).css({'grid-area': '2 / col1'});
		let label2 = $('<div/>').appendTo(grid).css({'grid-area': '2 / col2'});
		this.inputGeom2 = $('<input type="number" size="8"/>').appendTo(grid).css({'grid-area': '2 / col3'});

		this.geomWidget.callbackSelect = (sel:GeomWidgetSelection) =>
		{
			let atoms = this.geomWidget.selectionAtoms(sel);
			if (sel.type == GeomWidgetSelType.Position)
			{
				label1.text('Position X');
				label2.text('Y');
				this.inputGeom1.val(this.refGeom1 = mol.atomX(atoms[0]).toFixed(3));
				this.inputGeom2.val(this.refGeom2 = mol.atomY(atoms[0]).toFixed(3));
			}
			else if (sel.type == GeomWidgetSelType.Link)
			{
				let dx = mol.atomX(atoms[1]) - mol.atomX(atoms[0]), dy = mol.atomY(atoms[1]) - mol.atomY(atoms[0]);
				label1.text('Distance');
				label2.text('Angle');
				this.inputGeom1.val(this.refGeom1 = norm_xy(dx, dy).toFixed(3));
				this.inputGeom2.val(this.refGeom2 = (Math.atan2(dy, dx) * RADDEG).toFixed(1));
			}
			else if (sel.type == GeomWidgetSelType.Torsion)
			{
				let cx = mol.atomX(atoms[0]), cy = mol.atomY(atoms[0]);
				let th2 = Math.atan2(mol.atomY(atoms[1]) - cy, mol.atomX(atoms[1]) - cx);
				let th1 = Math.atan2(mol.atomY(atoms[2]) - cy, mol.atomX(atoms[2]) - cx);
				label1.text('Angle');
				label2.text('');
				this.inputGeom1.val(this.refGeom1 = (angleDiffPos(th2, th1) * RADDEG).toFixed(1));
				this.inputGeom2.val(this.refGeom2 = '');
			}
			label2.css('display', sel.type == GeomWidgetSelType.Torsion ? 'none' : 'block');
			this.inputGeom2.css('display', sel.type == GeomWidgetSelType.Torsion ? 'none' : 'block');
		};
		this.geomWidget.callbackSelect(this.geomWidget.selected); // trigger initial definition
	}

	private populateQuery(panel:JQuery):void
	{
		panel.append('Query: TODO');
	}

	private populateExtra(panel:JQuery):void
	{
		let fields = [...this.mol.atomExtra(this.atom), ...this.mol.atomTransient(this.atom)];
		this.fieldsWidget = new ExtraFieldsWidget(fields);
		this.fieldsWidget.render(panel);
	}

	// read everything back in from the dialog objects
	private updateMolecule():void
	{
		let {mol, atom} = this;

		if (atom == 0) atom = this.atom = mol.addAtom('C', this.newX, this.newY);

		let sym = this.inputSymbol.val();
		if (sym != '') mol.setAtomElement(atom, sym);

		let chg = parseInt(this.inputCharge.val());
		if (chg > -20 && chg < 20) mol.setAtomCharge(atom, chg);

		let unp = parseInt(this.inputUnpaired.val());
		if (unp >= 0 && unp < 20) mol.setAtomUnpaired(atom, unp);

		if (this.optionHydrogen.getSelectedIndex() == 1)
		{
			let hyd = parseInt(this.inputHydrogen.val());
			if (hyd >= 0 && hyd < 20) mol.setAtomHExplicit(atom, hyd);
		}
		else mol.setAtomHExplicit(atom, Molecule.HEXPLICIT_UNKNOWN);

		if (this.optionIsotope.getSelectedIndex() == 1)
		{
			let iso = parseInt(this.inputIsotope.val());
			if (iso >= 0 && iso < 300) mol.setAtomIsotope(atom, iso);
		}
		else mol.setAtomIsotope(atom, Molecule.ISOTOPE_NATURAL);

		let map = parseInt(this.inputMapping.val());
		if (!isNaN(map)) mol.setAtomMapNum(atom, map);
	}

	private updateAbbrev():void
	{
		const {mol, atom} = this;

		if (this.currentAbbrev < 0)
		{
			let el = mol.atomElement(atom);
			MolUtil.clearAbbrev(mol, atom); // (resets the element)
			mol.setAtomElement(atom, el);
		}
		else
		{
			let abbrev = this.abbrevList[this.currentAbbrev];
			mol.setAtomElement(atom, abbrev.name);
			MolUtil.setAbbrev(mol, atom, abbrev.frag);
		}
	}

	private updateGeometry():void
	{
		let strval1 = this.inputGeom1.val(), strval2 = this.inputGeom2.val();
		if (this.refGeom1 == strval1 && this.refGeom2 == strval2) return;

		const {mol} = this;
		let sel = this.geomWidget.selected, atoms = this.geomWidget.selectionAtoms(sel);

		if (sel.type == GeomWidgetSelType.Position)
		{
			let x = parseFloat(strval1), y = parseFloat(strval2);
			if (isNaN(x) || isNaN(y) || Math.abs(x) > 1E6 || Math.abs(y) > 1E6) return; // non-sane
			mol.setAtomPos(atoms[0], x, y);
		}
		else if (sel.type == GeomWidgetSelType.Link)
		{
			if (this.refGeom1 != strval1)
			{
				let dist = parseFloat(strval1);
				if (isNaN(dist) || Math.abs(dist) > 100) return; // non-sane
				let mask = Vec.booleanArray(false, mol.numAtoms);
				mask[atoms[1] - 1] = true;
				let instate:SketchState = {'mol': mol, 'currentAtom': 0, 'currentBond': mol.findBond(atoms[0], atoms[1]), 'selectedMask': mask};
				let molact = new MoleculeActivity(instate, ActivityType.BondDist, {'dist': dist});
				molact.execute();
				this.mol = molact.output.mol;
				return;
			}
			else if (this.refGeom2 != strval2)
			{
				let angle = parseFloat(strval2);
				if (isNaN(angle)) return; // non-sane		
				let mask = Vec.booleanArray(false, mol.numAtoms);
				mask[atoms[1] - 1] = true;
				let instate:SketchState = {'mol': mol, 'currentAtom': 0, 'currentBond': mol.findBond(atoms[0], atoms[1]), 'selectedMask': mask};
				let molact = new MoleculeActivity(instate, ActivityType.AlignAngle, {'angle': angle * DEGRAD});
				molact.execute();
				this.mol = molact.output.mol;
				return;
			}
		}
		else if (sel.type == GeomWidgetSelType.Torsion)
		{
			let angle = parseFloat(strval1);
			if (isNaN(angle)) return; // non-sane		
			let mask = Vec.booleanArray(false, mol.numAtoms);
			for (let a of atoms) mask[a - 1] = true;
			let instate:SketchState = {'mol': mol, 'currentAtom': atoms[2], 'currentBond': 0, 'selectedMask': mask};
			let molact = new MoleculeActivity(instate, ActivityType.AdjustTorsion, {'angle': angle * DEGRAD});
			molact.execute();
			this.mol = molact.output.mol;
			return;
		}
	}

	private updateExtra():void
	{
		this.mol.setAtomExtra(this.atom, this.fieldsWidget.getExtraFields());
		this.mol.setAtomTransient(this.atom, this.fieldsWidget.getTransientFields());
	}

	// enumerate all abbreviations compatible with the search; it will go into self-callback mode if the abbreviations need to be loaded
	private fillAbbreviations():void
	{
		if (AbbrevContainer.needsSetup())
		{
			setTimeout(() => AbbrevContainer.setupData().then(() => this.fillAbbreviations()), 1);
			return;
		}

		this.tableAbbrev.empty();

		AbbrevContainer.main.submitMolecule(this.mol, true);
		this.abbrevList = AbbrevContainer.main.getAbbrevs();
		if (!this.svgAbbrev)
		{
			this.svgAbbrev = [];
			let policy = RenderPolicy.defaultColourOnWhite(10);
			let measure = new OutlineMeasurement(0, 0, policy.data.pointScale);

			for (let abbrev of this.abbrevList)
			{
				let effects = new RenderEffects();
				let mol = abbrev.frag.clone();
				effects.atomCircleSz = Vec.numberArray(0, mol.numAtoms);
				effects.atomCircleCol = Vec.numberArray(0, mol.numAtoms);
				for (let n = 1; n <= mol.numAtoms; n++) if (mol.atomElement(n) == MolUtil.ABBREV_ATTACHMENT)
				{
					mol.setAtomElement(n, 'C');
					effects.atomCircleSz[n - 1] = 0.2;
					effects.atomCircleCol[n - 1] = 0x00C000;
				}
				let layout = new ArrangeMolecule(mol, measure, policy, effects);
				layout.arrange();
				// !! max size
				let gfx = new MetaVector();
				new DrawMolecule(layout, gfx).draw();
				gfx.normalise();
				this.svgAbbrev.push(gfx.createSVG());
			}

			// see if the current abbreviation matches anything
			const {mol, atom} = this;
			if (MolUtil.hasAbbrev(mol, atom))
			{
				let name = mol.atomElement(atom), mf = MolUtil.molecularFormula(MolUtil.getAbbrev(mol, atom));
				for (let n = 0; n < this.abbrevList.length; n++) if (name == this.abbrevList[n].name)
				{
					// NOTE: just going by name & basic molecule formula; using sketchMappable fails because layout can vary
					//if (CoordUtil.sketchMappable(abbrevs[n].frag, MolUtil.getAbbrev(mol, atom))) this.currentAbbrev = n;
					if (mf == MolUtil.molecularFormula(this.abbrevList[n].frag)) this.currentAbbrev = n;
					break;
				}
			}
		}

		let tr = $('<tr/>').appendTo(this.tableAbbrev);
		tr.append('<td><u>Label</u></td>');
		tr.append('<td><u>Structure</u></td>');

		this.abbrevEntries = [];
		let search = this.inputAbbrevSearch.val().toLowerCase();

		for (let n = 0; n < this.abbrevList.length; n++)
		{
			if (this.currentAbbrev != n && !this.abbrevList[n].nameSearch.includes(search)) continue;

			let entry:EditAtomAbbrev =
			{
				'tr': $('<tr/>').appendTo(this.tableAbbrev),
				'idx': n,
				'bgcol': this.abbrevEntries.length % 2 == 0 ? '#FFFFFF' : '#F8F8F8'
			};
			entry.tr.css('background-color', this.currentAbbrev == entry.idx ? colourCode(Theme.lowlight) : entry.bgcol);
			let tdLabel = $('<td/>').appendTo(entry.tr), tdStruct = $('<td/>').appendTo(entry.tr);
			tdLabel.html(this.abbrevList[n].nameHTML);

			let svg = $(this.svgAbbrev[n]).appendTo(tdStruct);
			svg.css({'pointer-events': 'none'});

			entry.tr.css({'cursor': 'pointer'});
			entry.tr.click(() => this.selectAbbreviation(n));
			entry.tr.dblclick(() => this.applyChanges());

			this.abbrevEntries.push(entry);
		}
	}

	// change currently selected abbreviation
	private selectAbbreviation(idx:number):void
	{
		if (this.currentAbbrev == idx) return;
		this.currentAbbrev = idx;

		for (let entry of this.abbrevEntries)
		{
			entry.tr.css('background-color', this.currentAbbrev == entry.idx ? colourCode(Theme.lowlight) : entry.bgcol);
		}
	}
}

/* EOF */ }