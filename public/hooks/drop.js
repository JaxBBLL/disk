const { ref } = Vue;

export default (cb) => {
  let origin = null;

  const dragStart = (item, event) => {
    origin = item;
    event.dataTransfer.effectAllowed = "move";
    // event.dataTransfer.setData("text/plain", item);
  };

  const drop = (target) => {
    cb(origin, target);
    origin = null;
  };

  return {
    dragStart,
    drop,
  };
};
