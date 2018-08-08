class HyperSpacePseudoNode {
  constructor(Options) {
    this.lng = Options.lng,
    this.lat = Options.lat,
    this.hyperspaceLanes = [Options.hyperspaceLanes],
    this.system = Options.system;

    const xGalactic = getGalacticXFromLongitude(this.lng);
    const xGalacticLong = xGalactic;
    this.xGalactic = xGalactic;
    this.xGalacticLong = xGalacticLong;

    const yGalactic = getGalacticYFromLatitude(this.lat);
    const yGalacticLong = yGalactic;
    this.yGalactic = yGalactic;
    this.yGalacticLong = yGalacticLong;

    this.zoom = 5;
    this.emptySpace = true;

    this.nodeId = randomPseudoNodeId();
  }
};



function getGalacticYFromLatitude(latitude) {
  return  (-3.07e-19*(latitude**12)) + (-1.823e-18*(latitude**11)) + (4.871543e-15*(latitude**10)) + (4.1565807e-14*(latitude**9)) + (-2.900986202e-11 * (latitude**8)) + (-1.40444283864e-10*(latitude**7)) + (7.9614373223054e-8*(latitude**6)) + (7.32976568692443e-7*(latitude**5)) + (-0.00009825374539548058*(latitude**4)) + (0.005511093818675318*(latitude**3)) + (0.04346753629461727 * (latitude**2)) + (111.30155374684914 * latitude);
};

function getGalacticXFromLongitude(longitude) {
  return (111.3194866138503 * longitude);
};

function randomPseudoNodeId() { return Math.floor(Math.random()*90000) + 10000; }



module.exports = HyperSpacePseudoNode;