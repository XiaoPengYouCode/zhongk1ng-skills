---
name: pstack-rust-best-practices
description: Rust 类型与 API 设计纪律，读写任何 .rs 文件时使用。覆盖 newtype、枚举建模、让非法状态不可表示、边界解析、错误类型、unwrap/expect、as 转换、借用与所有权、并发、unsafe、测试。
whenToUse: 读写 Rust 代码、设计公共 API、评审错误处理/借用模式/unsafe/并发时。
---

# Rust 最佳实践

先应用类型系统纪律：让非法状态不可表示，在边界解析一次，内部只信类型。

| 规则 | 要点 |
|------|------|
| Newtype | 有语义的 primitive 用 `struct UserId(u64)` 包一层，字段私有，只通过 `TryFrom`/`FromStr` 构造，`Display` 负责输出。不要到处传裸 `u64`、`String`。 |
| 枚举建模 | 变体用枚举加字段表达。不要 `bool` + `Option<T>` 这种能组合出矛盾状态的形状。 |
| 非法状态不可表示 | 用类型限制构造：`NonEmpty<T>`、`Range { start, len }` 而不是可矛盾的 `start`/`end`、`enum` 替代 `(bool, Option<T>)`。构造优先于运行时校验。 |
| 公共枚举 | 跨 crate 可能新增变体的枚举加 `#[non_exhaustive]`，消费端就不会被新变体打断编译。 |
| 边界解析 | CLI、配置、网络、反序列化进来的数据在边界转成领域类型（`TryFrom<Raw>`、`FromStr`），之后内部只收领域类型。 |
| 不用 `as` 做有损转换 |  widening 用 `u32::from(x)`、`i64::try_from(x)?`。`as` 会静默截断和绕回（`i32 as u64` 负数变大数），只在证明无损且显而易见处使用。 |
| 禁止 `unwrap` | 生产代码不用 `unwrap`。`expect` 只用于已证明不可达的分支，并写清为什么不可达；拿不出证明就用 `ok_or_else` 加 `?`。测试里可以用。 |
| 错误类型 | 库导出具体错误枚举（`thiserror`），应用层用 `anyhow`/`eyre` 带上上下文。公共 API 不要返回 `Box<dyn Error>`。 |
| match 穷尽 | 领域枚举的 `match` 不加 `_ =>`，让编译器在新变体出现时报错。用 `_` 只在外来或开放枚举上。 |
| 借用优先 | 参数取 `&str`、`&[T]`、`&Path`、`impl AsRef<Path>`。只在需要所有权时收 `String`/`Vec<T>`。返回借用而非克隆，混合场景用 `Cow`。 |
| 克隆纪律 | 为了绕过借用检查器而 `.clone()` 通常是结构问题。先试只读借用、拆分结构、或缩小可变作用域。 |
| 不用哨兵值 | 不用 `-1`、空字符串、`usize::MAX` 表示缺失，用 `Option`/`Result`。 |
| 并发 | 优先用 channel 转移所有权，避免共享可变状态。必须共享时 `Arc<Mutex<_>>` 且临界区最小，不用 `Arc<Mutex<Vec<_>>>` 顶替管道。数据并行用 rayon。 |
| unsafe | 每个 `unsafe` 块写 `// SAFETY:` 说明维持了哪些不变量。能封装成安全抽象就不用，`unsafe fn` 内部默认仍按安全代码检查（`unsafe_op_in_unsafe_fn`）。 |
| 迭代器 | 用迭代器和组合子代替索引循环；`ok_or_else`、`map_or`、`?` 代替嵌套 `match`。 |
| 分派 | 泛型/`impl Trait` 静态分派优先。只有异构集合或需要稳定 ABI 时才用 `dyn Trait`。 |
| 公共 API 最小化 | 只 `pub` 必要项。可能被忽略的返回值加 `#[must_use]`。避免为省 clone 给结构体加生命周期参数，先确认所有权归属。 |
| 文档 | 公共项用 `///`，模块用 `//!`，示例写成 doctest 保证可运行。 |
| 测试行为 | 单元测试放同文件 `#[cfg(test)]`，集成测试放 `tests/`。边界与不变量用 property test（`proptest`）。 |
| Lint | CI 跑 `cargo clippy --all-targets -- -D warnings`。对溢出敏感的代码开 `overflow-checks` 或用 `checked_*`。 |

## 示例

### Newtype 与边界解析

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(u64);

impl TryFrom<u64> for UserId {
    type Error = UserIdError;

    fn try_from(raw: u64) -> Result<Self, Self::Error> {
        if raw == 0 {
            return Err(UserIdError::Zero);
        }
        Ok(Self(raw))
    }
}
```

### 枚举代替布尔组合

```rust
// 不要：loading 与 error 能同时成立
struct State {
    loading: bool,
    diff: Option<Diff>,
    error: Option<String>,
}

// 要：只有合法状态存在
enum State {
    Loading,
    Ready(Diff),
    Failed(String),
}
```

### 穷尽匹配

```rust
match state {
    State::Loading => render_spinner(),
    State::Ready(diff) => render_diff(&diff),
    State::Failed(msg) => render_error(&msg),
}
```

### 错误枚举与 `?`

```rust
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("config file `{path}` is unreadable: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("field `{field}` is invalid: {reason}")]
    Invalid { field: &'static str, reason: String },
}

fn load(path: impl AsRef<Path>) -> Result<Config, ConfigError> {
    let text = std::fs::read_to_string(path.as_ref()).map_err(|source| ConfigError::Io {
        path: path.as_ref().to_owned(),
        source,
    })?;
    parse(&text)
}
```

### unsafe 附带证明

```rust
// SAFETY: `index` 由 `checked_index` 的上界检查保证小于 `len`，
// 切片在该调用期间不被改写。
let value = unsafe { slice.get_unchecked(index) };
```
