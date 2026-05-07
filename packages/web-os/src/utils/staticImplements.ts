/** 编译期校验「仅 static API」的工具类是否实现静态侧契约（见 packages 约定）。 */
export function staticImplements<T>() {
  return <U extends T>(ctor: U) => ctor;
}
