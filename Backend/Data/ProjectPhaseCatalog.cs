namespace Blueprint.Api.Data;

public static class ProjectPhaseCatalog
{
    public const string PreliminaryProgram = "preliminary-program";
    public const string FeasibilityStudies = "feasibility-studies";
    public const string TopographicSurvey = "topographic-survey";
    public const string PreliminaryStudy = "preliminary-study";
    public const string PreliminaryDesign = "preliminary-design";
    public const string LicensingProject = "licensing-project";
    public const string SpecialtyProjects = "specialty-projects";
    public const string ExecutionProject = "execution-project";
    public const string MeasurementsAndBudgeting = "measurements-and-budgeting";
    public const string ContractorTender = "contractor-tender";
    public const string TechnicalConstructionAssistance = "technical-construction-assistance";
    public const string ConstructionSupervision = "construction-supervision";
    public const string HandoverAndOccupancyLicense = "handover-and-occupancy-license";
    public const string AsBuilt = "as-built";
    public const string Payment = "payment";

    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        [PreliminaryProgram] = "Programa Preliminar / Definição de Requisitos",
        [FeasibilityStudies] = "Estudos de Viabilidade",
        [TopographicSurvey] = "Levantamento Topográfico",
        [PreliminaryStudy] = "Estudo Prévio",
        [PreliminaryDesign] = "Anteprojeto",
        [LicensingProject] = "Projeto de Licenciamento",
        [SpecialtyProjects] = "Projeto de Especialidades",
        [ExecutionProject] = "Projeto de Execução",
        [MeasurementsAndBudgeting] = "Medições e Orçamentação",
        [ContractorTender] = "Concurso / Consulta a Empreiteiros",
        [TechnicalConstructionAssistance] = "Assistência Técnica à Obra",
        [ConstructionSupervision] = "Fiscalização da Obra",
        [HandoverAndOccupancyLicense] = "Receção da Obra e Licença de Utilização",
        [AsBuilt] = "As Built / Telas Finais",
        [Payment] = "Pagamento"
    };
}
