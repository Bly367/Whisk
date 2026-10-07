import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

private final class WhiskRecipeParseError: Exception {
  private let errorCode: String
  private let errorReason: String

  init(code: String, reason: String) {
    self.errorCode = code
    self.errorReason = reason
    super.init()
  }

  override var code: String { errorCode }
  override var reason: String { errorReason }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
private struct FoundationIngredient {
  var quantity: String?
  var unit: String?
  var name: String
  var note: String?
}

@available(iOS 26.0, *)
@Generable
private struct FoundationRecipe {
  var title: String
  var ingredients: [FoundationIngredient]
  var steps: [String]
}
#endif

public class WhiskRecipeParseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WhiskRecipeParse")

    Function("isFoundationModelsAvailable") {
      foundationModelsAvailable()
    }

    AsyncFunction("parseRecipeWithFoundationModels") { (sourceText: String) async throws -> [String: Any] in
      #if canImport(FoundationModels)
      guard #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable else {
        throw WhiskRecipeParseError(code: "ERR_UNAVAILABLE", reason: "Foundation Models is unavailable")
      }
      do {
        let session = LanguageModelSession(instructions: "Extract only recipe facts stated in the supplied text. Do not invent ingredients or steps.")
        let response = try await session.respond(to: sourceText, generating: FoundationRecipe.self)
        let recipe = response.content
        guard !recipe.title.isEmpty || !recipe.ingredients.isEmpty || !recipe.steps.isEmpty else {
          throw WhiskRecipeParseError(code: "ERR_PARSE_FAILED", reason: "No recipe content was found")
        }
        return [
          "title": recipe.title,
          "ingredients": recipe.ingredients.map { ingredient -> [String: Any] in
            [
              "quantity": ingredient.quantity ?? NSNull(),
              "unit": ingredient.unit ?? NSNull(),
              "name": ingredient.name,
              "note": ingredient.note ?? NSNull()
            ]
          },
          "steps": recipe.steps
        ]
      } catch let error as WhiskRecipeParseError {
        throw error
      } catch {
        throw WhiskRecipeParseError(code: "ERR_PARSE_FAILED", reason: "Foundation Models could not parse the recipe")
      }
      #else
      throw WhiskRecipeParseError(code: "ERR_UNAVAILABLE", reason: "Foundation Models is unavailable")
      #endif
    }
  }
}

private func foundationModelsAvailable() -> Bool {
  #if canImport(FoundationModels)
  if #available(iOS 26.0, *) {
    return SystemLanguageModel.default.isAvailable
  }
  #endif
  return false
}
