class GalacticPoint {
  constructor(
  	x,
    y
  ) {
  	this.x = x;
    this.y = y;
  }

  // quadrant() {
  //   const xIsPositive = this.x >= 0;
  //   const yIsPositive = this.y >= 0;
  //   if(xIsPositive && yIsPositive) {
  //     return 1;
  //   } else if(xIsPositive && !yIsPositive) {
  //     return 2;
  //   } else if(!xIsPositive && !yIsPositive) {
  //     return 3;
  //   } else if(!xIsPositive && yIsPositive) {
  //     return 4;
  //   }
  // }

  jumpToPointIsSpinward(TargetPoint) {
    if(this.y >= 0 && TargetPoint.y >= 0 && this.x >= 0) {
      return this.targetsXValueIsLesser(TargetPoint) && this.targetsYValueIsGreaterOrEqual(TargetPoint);
    } else if(this.y >= 0 && TargetPoint.y >= 0 && this.x < 0) {
      return this.targetsXValueIsLesser(TargetPoint) && this.targetsYValueIsLesserOrEqual(TargetPoint);
    } else if(this.y < 0 && TargetPoint.y < 0 && this.x >= 0) {
      return this.targetsXValueIsGreater(TargetPoint) && this.targetsYValueIsGreaterOrEqual(TargetPoint);
    } else if(this.y < 0 && TargetPoint.y < 0 && this.x < 0) {
      return this.targetsXValueIsGreater(TargetPoint) && this.targetsYValueIsLesserOrEqual(TargetPoint);
    } else if(this.y >= 0 && TargetPoint.y < 0) {

      return !this.xIsPositive();

      // if(this.xIsPositive()) {
      //   return false;
      // } else {
      //   return true;
      // }
    } else if(this.y < 0 && TargetPoint.y >= 0) {

      return this.xIsPositive();

      // if(this.xIsPositive()) {
      //   return true;
      // } else {
      //   return false;
      // }
    }
  }

  targetsXValueIsGreater(TargetPoint) {
    if(this.x < TargetPoint.x) {
      return true;
    } else {
      return false;
    }
  }

  targetsXValueIsLesser(TargetPoint) {
    if(this.x > TargetPoint.x) {
      return true;
    } else {
      return false;
    }
  }

  targetsYValueIsGreater(TargetPoint) {
    if(this.y < TargetPoint.y) {
      return true;
    } else {
      return false;
    }
  }

  targetsYValueIsLesser(TargetPoint) {
    if(this.y > TargetPoint.y) {
      return true;
    } else {
      return false;
    }
  }

  targetsYValueIsGreaterOrEqual(TargetPoint) {
    if(this.y <= TargetPoint.y) {
      return true;
    } else {
      return false;
    }
  }

  targetsYValueIsLesserOrEqual(TargetPoint) {
    if(this.y >= TargetPoint.y) {
      return true;
    } else {
      return false;
    }
  }

  xIsPositive() {
    return this.x >= 0;
  }
};




function quadrantOneJumpIsSpinward(CurrentPoint, TargetPoint) {
  return targetsXValueIsLesser(CurrentPoint, TargetPoint);
}

function quadrantTwoJumpIsSpinward(CurrentPoint, TargetPoint) {
  return targetsXValueIsGreater(CurrentPoint, TargetPoint);
}

function quadrantThreeJumpIsSpinward(CurrentPoint, TargetPoint) {
  return targetsXValueIsGreater(CurrentPoint, TargetPoint);
}

function quadrantFourJumpIsSpinward(CurrentPoint, TargetPoint) {
  return targetsXValueIsLesser(CurrentPoint, TargetPoint);
}

function targetsXValueIsGreater(CurrentPoint, TargetPoint) {
  if(CurrentPoint.x > TargetPoint.x) {
    return true;
  } else {
    return false;
  }
}

function targetsXValueIsLesser(CurrentPoint, TargetPoint) {
  if(CurrentPoint.x < TargetPoint.x) {
    return true;
  } else {
    return false;
  }
}
 







module.exports = GalacticPoint;