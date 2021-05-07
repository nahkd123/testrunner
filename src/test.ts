import { caseOf } from ".";

caseOf("test1", (assert) => {
    let foo = "bar";
    assert(foo, "bar");

    caseOf("children", (assert) => {
        let msg = "Nested test case";
        assert(msg, msg);
    });
});