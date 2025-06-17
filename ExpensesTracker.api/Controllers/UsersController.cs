using ExpensesTracker.api.Dtos.User;
using ExpensesTracker.api.DTOs.Login;
using ExpensesTracker.api.Helpers;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ITokenService _tokenService;

    public UsersController(IUserService userService, ITokenService tokenService)
    {
        _userService = userService;
        _tokenService = tokenService;
    }

    private bool IsAdmin() => User.IsInRole("Admin");

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!IsAdmin())
            return StatusCode(403, "Solo un Admin puede ver todos los usuarios.");

        var users = await _userService.GetAllAsync();

        var userDtos = users.Select(u => new UserDto
        {
            Id = u.Id,
            Username = u.Username
        });

        return Ok(userDtos);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
            return Unauthorized("Token inválido.");

        if (!IsAdmin() && userIdFromToken != id)
            return StatusCode(403, "No puedes acceder a los datos de otro usuario.");

        var user = await _userService.GetByIdAsync(id);
        if (user == null) return NotFound();

        var userDto = new UserDto
        {
            Id = user.Id,
            Username = user.Username
        };

        return Ok(userDto);
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        byte[] passwordSalt;
        var passwordHash = PasswordHelper.HashPassword(dto.Password, out passwordSalt);

        var user = new User
        {
            Username = dto.Username,
            PasswordHash = passwordHash,
            PasswordSalt = passwordSalt,
            Role = "User" // Forzamos a que todos se registren como "User"
        };

        var created = await _userService.CreateAsync(user);

        var result = new UserDto
        {
            Id = created.Id,
            Username = created.Username
        };

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _userService.GetByUsernameAsync(dto.Username);
        if (user == null || !PasswordHelper.VerifyPassword(dto.Password, user.PasswordHash, user.PasswordSalt))
            return Unauthorized("Usuario o contraseña incorrectos");

        var token = _tokenService.GenerateToken(user);

        return Ok(new { Token = token });
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserDto dto)
    {
        if (id != dto.Id) return BadRequest("ID mismatch");
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
            return Unauthorized("Token inválido.");

        if (!IsAdmin() && userIdFromToken != id)
            return StatusCode(403, "No tienes permiso para modificar a otro usuario.");

        var user = new User
        {
            Id = dto.Id,
            Username = dto.Username
        };

        var updated = await _userService.UpdateAsync(user);
        if (!updated) return NotFound();

        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!IsAdmin())
            return StatusCode(403, "Solo un Admin puede eliminar usuarios.");

        var deleted = await _userService.DeleteAsync(id);
        if (!deleted) return NotFound();

        return NoContent();
    }
}
